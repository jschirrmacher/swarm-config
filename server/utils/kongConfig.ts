import { writeFile, readdir, stat, readFile } from "fs/promises"
import { resolve, join } from "path"
import { dump, load } from "js-yaml"
import { getDomains } from "../../src/DomainRegister.js"

// Process plugins: replace ${ENV_VAR} placeholders and add domains for ACME
function processPlugins(plugins: any[]) {
  
  return plugins.map(plugin => {
    // Replace environment variables in config
    let config = plugin.config || {}
    
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

// Load .swarm/kong.yaml files from project directories in /var/apps
async function loadProjectServices(silent = false) {
  const workspaceBase = process.env.WORKSPACE_BASE || "/var/apps"
  const services = []

  try {
    const entries = await readdir(workspaceBase, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const serviceYamlFile = join(workspaceBase, entry.name, "kong.yaml")
        
        try {
          const content = await readFile(serviceYamlFile, "utf-8")
          const config = load(content) as any
          if (config && config.services) {
            services.push(config)
            if (!silent) console.log(`  ✓ ${entry.name}/kong.yaml`)
          }
        } catch (error) {
          // kong.yaml doesn't exist or can't be loaded - skip
        }
      }
    }
  } catch (error) {
    if (!silent) console.log(`  ℹ No projects found in ${workspaceBase}`)
  }

  if (!silent && services.length === 0) {
    console.log(`  ℹ Searched in: ${workspaceBase}`)
  }

  return services
}

// Load YAML files from a directory (for plugins)
async function loadYamlFiles(dirName: string, silent = false) {
  const dir = resolve(process.cwd(), "config", dirName)
  const items = []

  try {
    const files = await readdir(dir)
    const yamlFiles = files.filter(f => f.endsWith(".yaml") && !f.endsWith(".example"))

    for (const file of yamlFiles) {
      const filePath = join(dir, file)
      try {
        const content = await readFile(filePath, "utf-8")
        const yaml = load(content) as any
        if (yaml) {
          items.push(yaml)
          if (!silent) console.log(`  ✓ ${dirName}/${file}`)
        }
      } catch (error) {
        if (!silent) console.log(`  ⚠ ${dirName}/${file} could not be loaded`)
      }
    }
  } catch (error) {
    if (!silent) console.log(`  ℹ No ${dirName} found (directory empty or doesn't exist)`)
  }

  return items
}

// Load TypeScript modules from a directory (for consumers)
async function loadModules(dirName: string, silent = false) {
  const dir = resolve(process.cwd(), "config", dirName)
  const modules = []

  try {
    const files = await readdir(dir)
    const tsFiles = files.filter(f => f.endsWith(".ts") && !f.endsWith(".example"))

    for (const file of tsFiles) {
      const modulePath = join(dir, file)
      const module = await import(`file://${modulePath}`)
      if (module.default) {
        modules.push(module.default)
        if (!silent) console.log(`  ✓ ${dirName}/${file}`)
      }
    }
  } catch (error) {
    if (!silent) console.log(`  ℹ No ${dirName} found (directory empty or doesn't exist)`)
  }

  return modules
}

export async function generateKongConfig(silent = false) {
  if (!silent) {
    console.log("Generating kong.yaml...")
    console.log("")
    console.log("Loading configuration:")
  }

  // Load swarm-config's own kong.yaml
  const swarmConfigServices = []
  const swarmConfigServiceYaml = join(process.cwd(), ".swarm", "kong.yaml")
  try {
    const content = await readFile(swarmConfigServiceYaml, "utf-8")
    const config = load(content) as any
    if (config && config.services) {
      swarmConfigServices.push(config)
      if (!silent) console.log(`  ✓ swarm-config/.swarm/kong.yaml`)
    }
  } catch (error) {
    if (!silent) console.log(`  ⚠ swarm-config/.swarm/kong.yaml not found`)
  }

  // Load all configuration modules
  const [projectServices] = await Promise.all([
    loadProjectServices(silent),
  ])
  
  const allServices = [...swarmConfigServices, ...projectServices]

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
        https_redirect_status_code: 302,
      },
    ],
    plugins: [],
  }

  const config = {
    _format_version: "3.0",
    _transform: true,

    services: [
      ...allServices.flatMap(s => s.services || []),
      acmeDummyService,
    ],
    routes: [
      ...allServices.flatMap(s => s.routes || []),
      ...acmeDummyService.routes,
    ],
    plugins: [
      ...processPlugins(allServices.flatMap(s => s.plugins || [])),
    ],
  }

  if (!silent) {
    console.log("")
    console.log("Summary:")
    console.log(`  - ${allServices.length} services`)
    console.log(`  - 1 ACME dummy service`)
    console.log("")
  }

  await writeFile(resolve(process.cwd(), "generated", "kong.yaml"), dump(config))

  if (!silent) {
    console.log("✓ Generated: generated/kong.yaml")
    console.log("")
    console.log("ℹ To reload Kong with the new configuration, run: npm run kong:reload")
  }

  return config
}
