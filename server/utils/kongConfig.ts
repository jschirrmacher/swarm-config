import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve, join } from "path"
import { dump, load } from "js-yaml"
import { getDomains } from "./DomainRegister.js"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { isDevMode, getProjectConfig } from "./workspace"

const execAsync = promisify(exec)

type KongConfig = {
  services: unknown[]
  routes: unknown[]
  plugins: unknown[]
  consumers?: unknown[]
}

function processPlugins(plugins: any[]) {
  return plugins.map(plugin => {
    let config = plugin.config ?? {}

    if (plugin.name === "acme") {
      const techEmail = process.env.NUXT_TECH_EMAIL || process.env.TECH_EMAIL || "tech@example.com"
      
      config = {
        ...config,
        domains: getDomains(),
        account_email: (config.account_email && config.account_email !== "${TECH_EMAIL}" && config.account_email !== "null")
          ? config.account_email
          : techEmail,
      }
    }

    return {
      name: plugin.name,
      ...(Object.keys(config).length > 0 && { config }),
    }
  })
}

function loadProjectServices() {
  const workspaceBase = process.env.WORKSPACE_BASE ?? process.env.NUXT_WORKSPACE_BASE ?? "/var/apps"
  const domain = process.env.NUXT_DOMAIN ?? process.env.DOMAIN ?? "example.com"

  if (!existsSync(workspaceBase)) {
    console.warn(`[Kong Config] Workspace base not found: ${workspaceBase}`)
    return []
  }

  try {
    const entries = readdirSync(workspaceBase, { withFileTypes: true })
    const configs: KongConfig[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

      const entryPath = join(workspaceBase, entry.name)

      if (existsSync(join(entryPath, "project.json"))) {
        const config = generateKongConfigFromProjectJson(entryPath, entry.name, entry.name, domain)
        if (config) configs.push(config)
        continue
      } else if (existsSync(join(entryPath, "kong.yaml"))) {
        const config = loadKongYaml(join(entryPath, "kong.yaml"), entry.name)
        if (config) configs.push(config)
        continue
      }

      try {
        const subEntries = readdirSync(entryPath, { withFileTypes: true })
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() && !subEntry.isSymbolicLink()) continue

          const subProjectDir = join(entryPath, subEntry.name)

          if (existsSync(join(subProjectDir, "project.json"))) {
            const config = generateKongConfigFromProjectJson(
              subProjectDir,
              subEntry.name,
              entry.name,
              domain,
            )
            if (config) configs.push(config)
          } else if (existsSync(join(subProjectDir, "kong.yaml"))) {
            const config = loadKongYaml(
              join(subProjectDir, "kong.yaml"),
              `${entry.name}/${subEntry.name}`,
            )
            if (config) configs.push(config)
          }
        }
      } catch {}
    }

    return configs
  } catch (error) {
    return []
  }
}

function generateKongConfigFromProjectJson(
  projectDir: string,
  projectName: string,
  owner: string,
  domain: string,
): KongConfig | null {
  const metadata = getProjectConfig(projectDir)

  if (!metadata) {
    return null
  }

  try {
    const hostname = metadata.hostname || `${projectName}.${domain}`
    const serviceName = `${owner}_${projectName}_${projectName}`
    const containerName = metadata.serviceName || `${projectName}_${projectName}`
    const service = {
      name: serviceName,
      url: `http://${containerName}:${metadata.port || 3000}`,
      routes: (metadata.routes || [{ paths: ["/"], stripPath: false, preserveHost: true }]).map(
        (route: any, idx: number) => ({
          name: `${serviceName}_${idx}`,
          hosts: [hostname],
          paths: route.paths || ["/"],
          protocols: ["https"],
          preserve_host: route.preserveHost ?? true,
          strip_path: route.stripPath ?? false,
        }),
      ),
      plugins: metadata.plugins || [],
    }

    return {
      services: [service],
      routes: [],
      plugins: [],
    }
  } catch (error) {
    return null
  }
}

function loadKongYaml(path: string, name: string): KongConfig | null {
  try {
    let content = readFileSync(path, "utf-8")
    content = content.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "")
    const config = load(content) as KongConfig

    if (config && (config.services || config.routes || config.plugins || config.consumers)) {
      return config
    }
  } catch (error) {}
  return null
}

export async function generateKongConfig() {
  const allServices = loadProjectServices()
  const { registerDomain, getDomains, clearDomains } = await import("./DomainRegister.js")

  clearDomains()

  for (const service of allServices) {
    for (const route of (service.routes ?? []) as any[]) {
      for (const host of route.hosts ?? []) {
        registerDomain(host)
      }
    }

    for (const svc of (service.services ?? []) as any[]) {
      for (const route of (svc.routes ?? []) as any[]) {
        for (const host of route.hosts ?? []) {
          registerDomain(host)
        }
      }
    }
  }

  const acmeDummyService = {
    name: "acme-dummy",
    url: "http://127.0.0.1:65535",
    routes: [
      {
        name: "acme-dummy",
        protocols: ["http"],
        paths: ["/.well-known/acme-challenge"],
        hosts: getDomains(),
        preserve_host: true,
        strip_path: false,
      },
    ],
    plugins: [],
  }

  const extractedServices = allServices.flatMap(config => {
    if (!config.services || !Array.isArray(config.services)) {
      return []
    }

    const services = config.services as any[]
    const topLevelRoutes = (config.routes ?? []) as any[]

    if (topLevelRoutes.length > 0) {
      return services.map(service => {
        const serviceRoutes = topLevelRoutes.filter(route => route.service === service.name)

        if (service.routes && Array.isArray(service.routes) && service.routes.length > 0) {
          return service
        }

        if (serviceRoutes.length > 0) {
          return {
            ...service,
            routes: serviceRoutes.map(({ service: _, ...route }) => route),
          }
        }

        return service
      })
    }

    return services
  })

  const allPlugins = allServices.flatMap(s => s.plugins ?? [])

  const config = {
    _format_version: "3.0",
    _transform: true,

    services: [...extractedServices, acmeDummyService],
    plugins: [...processPlugins(allPlugins)],
    consumers: [...allServices.flatMap(s => s.consumers ?? [])],
  }

  const dataDir = resolve(process.cwd(), "data")
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  writeFileSync(
    resolve(dataDir, "kong.yaml"),
    dump(config, {
      noCompatMode: true,
      quotingType: '"',
    }),
  )

  return config
}

export async function reloadKongConfig() {
  await generateKongConfig()

  const grepPattern = isDevMode() ? "-kong-" : "_kong.1"
  const { stdout } = await execAsync(`docker ps --format "{{.Names}}" | grep ${grepPattern}`)
  const kongContainer = stdout.trim()

  if (kongContainer) {
    await execAsync(`docker exec ${kongContainer} kong config parse /config/kong.yaml`)
    await execAsync(`docker exec ${kongContainer} kong reload`)
  }
}
