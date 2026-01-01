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

  // Import getDomains for ACME dummy service
  const { getDomains } = await import("../../src/DomainRegister.js")

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

  const config = {
    _format_version: "3.0",
    _transform: true,

    services: [...allServices.flatMap(s => s.services ?? []), acmeDummyService],
    routes: [...allServices.flatMap(s => s.routes ?? []), ...acmeDummyService.routes],
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
