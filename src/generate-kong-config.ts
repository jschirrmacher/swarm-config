import { writeFile, readdir } from "fs/promises"
import { resolve, join } from "path"
import { dump } from "js-yaml"

// Load TypeScript modules from a directory
async function loadModules(dirName: string) {
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
        console.log(`  ✓ ${dirName}/${file}`)
      }
    }
  } catch (error) {
    console.log(`  ℹ No ${dirName} found (directory empty or doesn't exist)`)
  }

  return modules
}

console.log("Generating kong.yaml...")
console.log("")
console.log("Loading configuration:")

// Load all configuration modules
const [services, plugins, consumers] = await Promise.all([
  loadModules("services"),
  loadModules("plugins"),
  loadModules("consumers"),
])

const config = {
  _format_version: "3.0",
  _transform: true,

  services: services.flatMap(service => service.get()),
  plugins: plugins.map(plugin => plugin.get()),
  consumers: consumers.map(c => ({ username: c.username })),
  basicauth_credentials: consumers,
}

console.log("")
console.log("Summary:")
console.log(`  - ${services.length} services`)
console.log(`  - ${plugins.length} global plugins`)
console.log(`  - ${consumers.length} consumers`)
console.log("")

await writeFile(resolve(process.cwd(), "generated", "kong.yaml"), dump(config))
console.log("✓ Generated: generated/kong.yaml")

// Reload Kong
console.log("")
console.log("Reloading Kong...")

const { exec } = await import("child_process")
const { promisify } = await import("util")
const execAsync = promisify(exec)

try {
  // Find Kong container
  const { stdout: containerName } = await execAsync(
    'docker ps --format "{{.Names}}" | grep _kong.1',
  )
  const kong = containerName.trim()

  if (!kong) {
    console.error("✗ Kong container not found")
    process.exit(1)
  }

  // Validate configuration
  console.log("  Validating configuration...")
  await execAsync(`docker exec ${kong} kong config parse /config/kong.yaml`)
  console.log("  ✓ Configuration valid")

  // Reload Kong
  console.log("  Reloading Kong...")
  await execAsync(`docker exec ${kong} kong reload`)
  console.log("✓ Kong reloaded successfully")
} catch (error) {
  console.error("✗ Failed to reload Kong:", error instanceof Error ? error.message : String(error))
  process.exit(1)
}
