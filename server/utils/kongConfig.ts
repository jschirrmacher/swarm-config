import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { resolve, join } from "path"
import { dump, load } from "js-yaml"
import { getDomains } from "../../src/DomainRegister.js"

type KongConfig = {
  services: unknown[]
  routes: unknown[]
  plugins: unknown[]
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

// Load .swarm/kong.yaml files from project directories
function loadProjectServices(silent = false) {
  const workspaceBase = process.env.WORKSPACE_BASE ?? "/var/apps"

  try {
    const configs = readdirSync(workspaceBase, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const relativePath = [".swarm/kong.yaml", "kong.yaml"].find(path =>
          existsSync(join(workspaceBase, entry.name, path)),
        )
        if (!relativePath) return null

        try {
          const content = readFileSync(join(workspaceBase, entry.name, relativePath), "utf-8")
          const config = load(content) as KongConfig
          if (config.services) {
            if (!silent) console.log(`  ✓ ${entry.name}/${relativePath}`)
            return config
          }
        } catch {
          // kong.yaml can't be loaded - skip
        }
        return null
      })
      .filter((config): config is KongConfig => config !== null)

    if (!silent && configs.length === 0) {
      console.log(`  ℹ Searched in: ${workspaceBase}`)
    }

    return configs
  } catch {
    if (!silent) console.log(`  ℹ No projects found in ${workspaceBase}`)
    return []
  }
}

export async function generateKongConfig(silent = false) {
  if (!silent) {
    console.log("Generating kong.yaml...")
    console.log("")
    console.log("Loading configuration:")
  }

  // Load all project services (including swarm-config itself)
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
  }

  if (!silent) {
    console.log("")
    console.log("Summary:")
    console.log(`  - ${allServices.length} services`)
    console.log(`  - 1 ACME dummy service`)
    console.log("")
  }

  writeFileSync(
    resolve(process.cwd(), "generated", "kong.yaml"),
    dump(config, {
      noCompatMode: true,
      quotingType: '"',
    }),
  )

  if (!silent) {
    console.log("✓ Generated: generated/kong.yaml")
    console.log("")
    console.log("ℹ To reload Kong with the new configuration, run: npm run kong:reload")
  }

  return config
}
