import { createAcmePlugin, createRedisStorage } from "../../src/Plugin.js"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// ACME Plugin for automatic SSL/TLS certificate management via Let's Encrypt
// Reads technical contact email from .swarm-config file

let techEmail = "tech@example.com"

try {
  const configPath = join(process.cwd(), ".swarm-config")
  const configContent = readFileSync(configPath, "utf-8")
  const emailMatch = configContent.match(/^TECH_EMAIL=(.+)$/m)

  if (emailMatch && emailMatch[1]) {
    techEmail = emailMatch[1].trim()
  }
} catch (error) {
  console.warn("Could not read TECH_EMAIL from .swarm-config, using default:", techEmail)
}

export default createAcmePlugin(techEmail, [createRedisStorage()])
