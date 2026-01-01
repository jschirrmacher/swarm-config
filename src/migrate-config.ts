import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "fs"
import { join } from "path"

interface MigrationStats {
  count: number
}

/**
 * Migrates consumers from config.ts to config/consumers/
 */
function migrateConsumers(config: any, stats: MigrationStats): void {
  if (!config.consumers || !Array.isArray(config.consumers) || config.consumers.length === 0) {
    return
  }

  mkdirSync("config/consumers", { recursive: true })

  for (const consumer of config.consumers) {
    const file = join("config/consumers", `${consumer.username}.ts`)
    const content = `import type { Consumer } from "../../src/Consumer.js"

// Migrated from config.ts
const consumer: Consumer = {
  username: "${consumer.username}",
  password: "${consumer.password}",
}

export default consumer
`
    writeFileSync(file, content)
    console.log(`  ✓ Migrated consumer: ${consumer.username}`)
    stats.count++
  }
}

/**
 * Generates TypeScript code for a plugin config based on its data
 */
function generatePluginCode(pluginData: any): string {
  const { name, config } = pluginData
  const configStr = config ? `, ${JSON.stringify(config, null, 2)}` : ""

  if (name === "prometheus") {
    return `createPrometheusPlugin()`
  }

  if (name === "acme") {
    // ACME plugin with storage configuration
    const storageStr = config?.storage ? JSON.stringify(config.storage, null, 2) : "{}"
    return `createAcmePlugin("${config?.account?.email || ""}", [createRedisStorage()])`
  }

  return `createPlugin("${name}"${configStr})`
}

/**
 * Generates plugin file content based on plugin type
 */
function generatePluginContent(pluginData: any): string {
  const { name } = pluginData
  const pluginCode = generatePluginCode(pluginData)

  // Determine needed imports
  const imports: string[] = []
  if (pluginCode.includes("createPrometheusPlugin")) {
    imports.push("createPrometheusPlugin")
  }
  if (pluginCode.includes("createAcmePlugin")) {
    imports.push("createAcmePlugin", "createRedisStorage")
  }
  if (pluginCode.includes("createPlugin")) {
    imports.push("createPlugin")
  }

  const importStr =
    imports.length > 0 ? `import { ${imports.join(", ")} } from "../../src/Plugin.js"\n\n` : ""

  return `${importStr}// ${name} plugin
// Migrated from config.ts

export default ${pluginCode}
`
}

/**
 * Migrates plugins from config.ts to config/plugins/
 */
function migratePlugins(config: any, stats: MigrationStats): void {
  if (!config.plugins || !Array.isArray(config.plugins) || config.plugins.length === 0) {
    return
  }

  mkdirSync("config/plugins", { recursive: true })

  for (const plugin of config.plugins) {
    const pluginData = plugin.get()
    const pluginName = pluginData.name

    // Skip ACME plugin - it's already in the standard config
    if (pluginName === "acme") {
      console.log(`  ⏭️  Skipping plugin: ${pluginName} (already in standard config)`)
      continue
    }

    const file = join("config/plugins", `${pluginName}.ts`)
    const content = generatePluginContent(pluginData)

    writeFileSync(file, content)
    console.log(`  ✓ Migrated plugin: ${pluginName}`)
    stats.count++
  }
}

/**
 * Reconstructs TypeScript code for a service route
 */
function generateRouteCode(route: any): string {
  const options: string[] = []

  if (route.paths && route.paths.length > 0) {
    options.push(`paths: ${JSON.stringify(route.paths)}`)
  }
  if (route.strip_path !== false && route.strip_path) {
    options.push(`strip_path: true`)
  }
  if (route.name && !route.name.endsWith("_redirect")) {
    options.push(`name: "${route.name}"`)
  }

  const host = route.hosts?.[0] || ""
  const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : ""

  return `.addRoute("${host}"${optionsStr})`
}

/**
 * Reconstructs TypeScript code for a service with all its routes and plugins
 */
function generateServiceCode(stackServices: any[]): string {
  if (stackServices.length === 0) return ""

  const lines: string[] = []

  for (const service of stackServices) {
    const { name, url, routes, plugins } = service

    // Extract stack name and service name from combined name
    const parts = name.split("_")
    const serviceName = parts[parts.length - 1]

    // Extract port from URL
    const portMatch = url.match(/:(\d+)$/)
    const port = portMatch ? portMatch[1] : "80"

    // Build service line
    let serviceLine = `.addService("${serviceName}", ${port})`
    lines.push(serviceLine)

    // Add routes
    for (const route of routes) {
      lines.push(generateRouteCode(route))
    }

    // Add plugins
    for (const plugin of plugins || []) {
      const configStr = plugin.config ? `, ${JSON.stringify(plugin.config)}` : ""
      lines.push(`.addPlugin("${plugin.name}"${configStr})`)
    }
  }

  return lines.join("\n    ")
}

/**
 * Detects the type of stack and generates appropriate migration
 */
function migrateStackService(stack: any, stats: MigrationStats): void {
  if (!stack || typeof stack.get !== "function") {
    console.log("  ⚠️  Skipping invalid stack (no get() method)")
    return
  }

  const result = stack.get()

  // Check if this is a single service object (from builder chain) or an array
  let services: any[]
  if (Array.isArray(result)) {
    services = result
  } else if (result && typeof result === "object" && result.name) {
    // Single service object - wrap it in an array
    services = [result]
  } else {
    console.log("  ⚠️  Skipping stack with unexpected get() result:", typeof result)
    return
  }

  if (services.length === 0) {
    console.log("  ⚠️  Skipping empty stack")
    return
  }

  const firstService = services[0]
  if (!firstService || !firstService.name) {
    console.log("  ⚠️  Skipping stack with invalid first service")
    return
  }

  const stackName = firstService.name.split("_")[0]

  // Skip acme service
  if (stackName === "acme-dummy") {
    console.log(`  ⏭️  Skipping service: acmeService (already in standard config)`)
    return
  }

  // Skip swarm-config (handled separately)
  if (stackName === "swarm-config") {
    console.log(`  ⏭️  Skipping service: swarm-config (infrastructure)`)
    return
  }

  // Check if this is a Portainer or Monitoring stack - these remain as examples
  if (
    (firstService.name.includes("_portainer") && firstService.url.includes(":9000")) ||
    (services.some((s: any) => s.name.includes("_prometheus")) &&
      services.some((s: any) => s.name.includes("_grafana")))
  ) {
    console.log(`  ⏭️  Skipping infrastructure service: ${stackName} (kept as example)`)
    return
  }

  // Regular service - migrate to /var/apps/<stackName>/.swarm/kong.yaml
  const workspaceBase = process.env.WORKSPACE_BASE || "/var/apps"
  const projectDir = join(workspaceBase, stackName)
  const swarmDir = join(projectDir, ".swarm")
  const serviceFile = join(swarmDir, "kong.yaml")

  // Create .swarm directory if it doesn't exist
  mkdirSync(swarmDir, { recursive: true })

  // Extract port from first service
  const portMatch = firstService.url.match(/:(\d+)$/)
  const port = portMatch ? portMatch[1] : "3000"

  // Get domain from first route
  const domain =
    firstService.routes[0]?.hosts[0]?.replace(new RegExp(`^${stackName}\\.`), "") || "example.com"

  // Generate YAML format
  const yamlServices = services.map((s: any) => ({
    name: s.name,
    url: s.url,
  }))

  const yamlRoutes = services.flatMap((s: any) =>
    s.routes.map((r: any) => ({
      name: r.name,
      hosts: r.hosts,
      paths: r.paths,
      protocols: r.protocols,
      preserve_host: r.preserve_host,
      strip_path: r.strip_path,
      service: s.name,
      ...(r.plugins && r.plugins.length > 0 ? { plugins: r.plugins } : {}),
    })),
  )

  const yamlPlugins = services.flatMap((s: any) => s.plugins || [])

  // Convert to YAML string manually (since we don't have js-yaml in migration script)
  let content = `# ${stackName} - Migrated from config.ts

services:
${yamlServices.map((s: any) => `  - name: ${s.name}\n    url: ${s.url}`).join("\n")}

routes:
${yamlRoutes
  .map((r: any) => {
    let routeYaml = `  - name: ${r.name}\n    hosts:\n${r.hosts.map((h: string) => `      - ${h}`).join("\n")}\n    paths:\n${r.paths.map((p: string) => `      - ${p}`).join("\n")}\n    protocols:\n${r.protocols.map((p: string) => `      - ${p}`).join("\n")}\n    preserve_host: ${r.preserve_host}\n    strip_path: ${r.strip_path}\n    service: ${r.service}`
    if (r.plugins) {
      routeYaml += `\n    plugins:\n${r.plugins.map((p: any) => `      - name: ${p.name}${p.config ? `\n        config: ${JSON.stringify(p.config)}` : ""}`).join("\n")}`
    }
    return routeYaml
  })
  .join("\n")}
`

  if (yamlPlugins.length > 0) {
    content += `\nplugins:\n${yamlPlugins.map((p: any) => `  - name: ${p.name}${p.config ? `\n    config: ${JSON.stringify(p.config)}` : ""}`).join("\n")}\n`
  }

  writeFileSync(serviceFile, content)
  console.log(`  ✓ Migrated service: ${stackName} -> /var/apps/${stackName}/.swarm/kong.yaml`)

  // Also create a basic .swarm/docker-compose.yaml
  const composeContent = `services:
  ${stackName}:
    image: \${IMAGE_NAME:-${stackName}:latest}
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "\${PORT:-${port}}:${port}"
    volumes:
      - ./data:/app/data
    networks:
      - kong-net
    labels:
      - "com.docker.stack.namespace=${stackName}"

networks:
  kong-net:
    external: true
`
  writeFileSync(join(swarmDir, "docker-compose.yaml"), composeContent)
  console.log(`  ✓ Created .swarm/docker-compose.yaml for ${stackName}`)

  stats.count++
}

/**
 * Migrates services from config.ts to /var/apps/<project>/.swarm/kong.yaml
 */
function migrateServices(config: any, stats: MigrationStats): void {
  if (!config.services || !Array.isArray(config.services) || config.services.length === 0) {
    return
  }

  // Work directly with the service objects
  for (const service of config.services) {
    migrateStackService(service, stats)
  }
}

/**
 * Migrates legacy config.ts to the new config/ directory structure
 */
async function migrateConfig() {
  const configPath = join(process.cwd(), "config.ts")

  if (!existsSync(configPath)) {
    console.log("No config.ts found to migrate")
    return
  }

  console.log("📦 Migrating config.ts to new structure...")

  try {
    // Read config.ts and replace .js imports with .ts for tsx to work
    let configContent = readFileSync(configPath, "utf-8")
    const hasJsImports = configContent.includes('.js"')

    if (hasJsImports) {
      console.log("  🔧 Fixing .js imports to .ts for migration...")

      // Remove imports for PortainerStack and MonitoringStack (no longer exist)
      configContent = configContent
        .replace(/from\s+["'](.+?)\.js["']/g, 'from "$1.ts"')
        .replace(/import\s+\{[^}]*createPortainerStack[^}]*\}\s+from\s+["'][^"']+["'];?\s*/g, "")
        .replace(/import\s+\{[^}]*createMonitoringStack[^}]*\}\s+from\s+["'][^"']+["'];?\s*/g, "")

      const tempConfigPath = join(process.cwd(), "config.temp.ts")

      try {
        writeFileSync(tempConfigPath, configContent)

        // Import the temporary config
        const config = await import(`file://${tempConfigPath}`)
        const stats: MigrationStats = { count: 0 }

        // Migrate all sections
        migrateConsumers(config, stats)
        migratePlugins(config, stats)
        migrateServices(config, stats)

        console.log(`  ✅ Migrated ${stats.count} items`)
        console.log("  📝 Backup of config.ts saved as config.ts.bak")

        // Clean up temp file and rename original
        renameSync(configPath, join(process.cwd(), "config.ts.bak"))
      } catch (importError) {
        console.error(
          "  ❌ Cannot load config.ts:",
          importError instanceof Error ? importError.message : String(importError),
        )
        console.log("  📝 config.ts contains invalid imports or missing dependencies")
        console.log("  💡 Skipping migration - you can migrate manually later")
        // Rename config.ts to .bak anyway to prevent future migration attempts
        renameSync(configPath, join(process.cwd(), "config.ts.invalid.bak"))
      } finally {
        // Always remove temp file
        if (existsSync(tempConfigPath)) {
          const { unlinkSync } = await import("fs")
          unlinkSync(tempConfigPath)
        }
      }
    } else {
      // No .js imports, can import directly
      const config = await import(`file://${configPath}`)
      const stats: MigrationStats = { count: 0 }

      migrateConsumers(config, stats)
      migratePlugins(config, stats)
      migrateServices(config, stats)

      console.log(`  ✅ Migrated ${stats.count} items`)
      console.log("  📝 Backup of config.ts saved as config.ts.bak")

      renameSync(configPath, join(process.cwd(), "config.ts.bak"))
    }
  } catch (error) {
    console.error("  ❌ Migration failed:", error instanceof Error ? error.message : error)
    console.log("  📝 config.ts preserved - please migrate manually")
    console.log("  💡 Tip: You can manually move services to /var/apps/<project>/.swarm/kong.yaml")
  }
}

migrateConfig()
