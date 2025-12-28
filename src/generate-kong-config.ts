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
  basicauth_credentials: consumers.map(c => ({
    username: c.username,
    password: c.password,
    consumer: { username: c.username }
  })),
}

console.log("")
console.log("Summary:")
console.log(`  - ${services.length} services`)
console.log(`  - ${plugins.length} global plugins`)
console.log(`  - ${consumers.length} consumers`)
console.log("")

await writeFile(resolve(process.cwd(), "generated", "kong.yaml"), dump(config))
console.log("✓ Generated: generated/kong.yaml")
console.log("")
console.log("ℹ To reload Kong with the new configuration, run: npm run kong:reload")
