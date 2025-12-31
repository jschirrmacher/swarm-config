import { writeFile, readdir, stat } from "fs/promises"
import { resolve, join } from "path"
import { dump } from "js-yaml"

// Load service.ts files from project directories in /var/apps
async function loadProjectServices(silent = false) {
  const workspaceBase = process.env.WORKSPACE_BASE || "/var/apps"
  const modules = []

  try {
    const entries = await readdir(workspaceBase, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const serviceFile = join(workspaceBase, entry.name, "service.ts")
        
        try {
          await stat(serviceFile)
          const module = await import(`file://${serviceFile}`)
          if (module.default) {
            modules.push(module.default)
            if (!silent) console.log(`  ✓ ${entry.name}/service.ts`)
          }
        } catch (error) {
          // service.ts doesn't exist or can't be loaded - skip
        }
      }
    }
  } catch (error) {
    if (!silent) console.log(`  ℹ No projects found in ${workspaceBase}`)
  }

  return modules
}

// Load TypeScript modules from a directory (for plugins and consumers)
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

  // Load all configuration modules
  const [services, plugins, consumers] = await Promise.all([
    loadProjectServices(silent),
    loadModules("plugins", silent),
    loadModules("consumers", silent),
  ])

  const config = {
    _format_version: "3.0",
    _transform: true,

    services: services.flatMap(service => service.get()),
    plugins: plugins.map(plugin => plugin.get()),
    consumers: consumers.map(c => ({
      username: c.username,
      basicauth_credentials: [
        {
          username: c.username,
          password: c.password,
        },
      ],
    })),
  }

  if (!silent) {
    console.log("")
    console.log("Summary:")
    console.log(`  - ${services.length} services`)
    console.log(`  - ${plugins.length} global plugins`)
    console.log(`  - ${consumers.length} consumers`)
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
