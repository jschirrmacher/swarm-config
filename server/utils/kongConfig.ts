import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve, join } from "path"
import { dump, load } from "js-yaml"
import { getDomains } from "../../src/DomainRegister.js"

type KongConfig = {
  services: unknown[]
  routes: unknown[]
  plugins: unknown[]
  consumers?: unknown[]
}

// Process plugins: replace ${ENV_VAR} placeholders and add domains for ACME
function processPlugins(plugins: any[]) {
  return plugins.map(plugin => {
    // Replace environment variables in config
    let config = plugin.config ?? {}

    if (plugin.name === "acme") {
      // Add domains for ACME plugin
      config = {
        ...config,
        domains: getDomains(),
      }

      // Replace ${TECH_EMAIL} with actual value
      if (config.account_email === "${TECH_EMAIL}") {
        config.account_email = process.env.TECH_EMAIL || "tech@example.com"
      }
    }

    return {
      name: plugin.name,
      ...(Object.keys(config).length > 0 && { config }),
    }
  })
}

// Load kong.yaml files from project directories
function loadProjectServices(silent = false) {
  const workspaceBase = process.env.WORKSPACE_BASE ?? "/var/apps"
  const domain = process.env.DOMAIN || "example.com"

  if (!silent) {
    console.log(`  Searching in: ${workspaceBase}`)
    console.log(`  Current directory: ${process.cwd()}`)
  }

  try {
    const entries = readdirSync(workspaceBase, { withFileTypes: true })
    if (!silent) {
      console.log(`  Found ${entries.length} entries in ${workspaceBase}`)
    }

    const configs: KongConfig[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

      const entryPath = join(workspaceBase, entry.name)
      
      // Check if this is a project directory (has kong.yaml or project.json)
      const kongYamlPath = join(entryPath, "kong.yaml")
      const projectJsonPath = join(entryPath, "project.json")
      
      if (existsSync(projectJsonPath)) {
        const config = loadProjectJson(projectJsonPath, entry.name, entry.name, domain, silent)
        if (config) configs.push(config)
        continue
      } else if (existsSync(kongYamlPath)) {
        // Legacy: support existing kong.yaml files
        const config = loadKongYaml(kongYamlPath, entry.name, silent)
        if (config) configs.push(config)
        continue
      }

      // Otherwise, check if it's a namespace directory (contains subdirectories)
      try {
        const subEntries = readdirSync(entryPath, { withFileTypes: true })
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() && !subEntry.isSymbolicLink()) continue
          
          const subProjectJsonPath = join(entryPath, subEntry.name, "project.json")
          const subKongYamlPath = join(entryPath, subEntry.name, "kong.yaml")
          
          if (existsSync(subProjectJsonPath)) {
            const config = loadProjectJson(subProjectJsonPath, subEntry.name, entry.name, domain, silent)
            if (config) configs.push(config)
          } else if (existsSync(subKongYamlPath)) {
            // Legacy: support existing kong.yaml files
            const config = loadKongYaml(subKongYamlPath, `${entry.name}/${subEntry.name}`, silent)
            if (config) configs.push(config)
          } else if (!silent) {
            console.log(`  ⊘ ${entry.name}/${subEntry.name} - no project.json or kong.yaml found`)
          }
        }
      } catch {
        // Not a directory or can't read - skip
      }
    }

    if (!silent && configs.length === 0) {
      console.log(`  ℹ Searched in: ${workspaceBase}`)
    }

    return configs
  } catch (error) {
    if (!silent) {
      console.log(
        `  ⚠️  Error reading ${workspaceBase}:`,
        error instanceof Error ? error.message : String(error),
      )
    }
    return []
  }
}

function loadProjectJson(path: string, projectName: string, owner: string, domain: string, silent: boolean): KongConfig | null {
  try {
    const content = readFileSync(path, "utf-8")
    const metadata = JSON.parse(content)
    
    const hostname = metadata.hostname || `${projectName}.${domain}`
    const serviceName = `${owner}_${projectName}_${projectName}`
    const service = {
      name: serviceName,
      url: `http://${projectName}_${projectName}:${metadata.port || 3000}`,
      routes: (metadata.routes || [{ paths: ["/"], stripPath: false, preserveHost: true }]).map((route: any, idx: number) => ({
        name: `${serviceName}_${idx}`,
        hosts: [hostname],
        paths: route.paths || ["/"],
        protocols: ["https"],
        preserve_host: route.preserveHost ?? true,
        strip_path: route.stripPath ?? false,
      })),
      plugins: metadata.plugins || [],
    }
    
    if (!silent) console.log(`  ✓ ${owner}/${projectName}/project.json`)
    
    return {
      services: [service],
      routes: [],
      plugins: [],
    }
  } catch (error) {
    if (!silent) {
      console.log(
        `  ✗ ${owner}/${projectName}/project.json - ${error instanceof Error ? error.message : "parse error"}`,
      )
    }
    return null
  }
}

function loadKongYaml(path: string, name: string, silent: boolean): KongConfig | null {
  try {
    let content = readFileSync(path, "utf-8")
    content = content.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "")
    const config = load(content) as KongConfig

    if (config && (config.services || config.routes || config.plugins || config.consumers)) {
      if (!silent) console.log(`  ✓ ${name}/kong.yaml`)
      return config
    } else {
      if (!silent) {
        console.log(
          `  ⚠ ${name}/kong.yaml - no services, routes, plugins, or consumers found`,
        )
      }
    }
  } catch (error) {
    if (!silent) {
      console.log(
        `  ✗ ${name}/kong.yaml - ${error instanceof Error ? error.message : "parse error"}`,
      )
    }
  }
  return null
}

export async function generateKongConfig(silent = false) {
  if (!silent) {
    console.log("Generating kong.yaml...")
    console.log("")
    console.log("Loading configuration:")
  }

  // Load all project services from WORKSPACE_BASE (includes swarm-config itself)
  const allServices = loadProjectServices(silent)

  // Import registerDomain and getDomains
  const { registerDomain, getDomains, clearDomains } = await import("../../src/DomainRegister.js")

  // Clear any previously registered domains
  clearDomains()

  // Extract and register all domains from routes
  for (const service of allServices) {
    // Check top-level routes
    for (const route of (service.routes ?? []) as any[]) {
      for (const host of route.hosts ?? []) {
        registerDomain(host)
      }
    }

    // Check nested service routes
    for (const svc of (service.services ?? []) as any[]) {
      for (const route of (svc.routes ?? []) as any[]) {
        for (const host of route.hosts ?? []) {
          registerDomain(host)
        }
      }
    }
  }

  // Add ACME dummy service for Let's Encrypt challenges
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

  // Extract all services from all configs and merge with top-level routes
  const extractedServices = allServices.flatMap(config => {
    if (!config.services || !Array.isArray(config.services)) {
      return []
    }

    const services = config.services as any[]
    const topLevelRoutes = (config.routes ?? []) as any[]

    // If there are top-level routes, merge them with their corresponding services
    if (topLevelRoutes.length > 0) {
      return services.map(service => {
        // Find routes that reference this service
        const serviceRoutes = topLevelRoutes.filter(route => route.service === service.name)

        // If service already has routes (nested format), keep those
        // Otherwise, add the top-level routes
        if (service.routes && Array.isArray(service.routes) && service.routes.length > 0) {
          return service
        }

        // Add top-level routes to the service
        if (serviceRoutes.length > 0) {
          return {
            ...service,
            routes: serviceRoutes.map(({ service: _, ...route }) => route), // Remove 'service' field
          }
        }

        return service
      })
    }

    return services
  })

  const config = {
    _format_version: "3.0",
    _transform: true,

    services: [...extractedServices, acmeDummyService],
    plugins: [...processPlugins(allServices.flatMap(s => s.plugins ?? []))],
    consumers: [...allServices.flatMap(s => s.consumers ?? [])],
  }

  if (!silent) {
    console.log("")
    console.log("Summary:")
    console.log(`  - ${allServices.length} services`)
    console.log(`  - 1 ACME dummy service`)
    console.log(`  - ${allServices.flatMap(s => s.consumers ?? []).length} consumers`)
    console.log("")
  }

  // Ensure data directory exists
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

  if (!silent) {
    console.log("✓ Generated: data/kong.yaml")
    console.log("")
    console.log("ℹ To reload Kong with the new configuration, run: npm run kong:reload")
  }

  return config
}
