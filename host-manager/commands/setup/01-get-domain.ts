import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Configure domain name
 * Sets the domain in /var/apps/swarm-config/.env
 */
export default defineSetupCommand({
  id: "01-get-domain",
  name: "Configure Domain",
  description: "Set domain name in configuration",

  async check() {
    try {
      const result = await executeOnHost(
        "test -f /var/apps/swarm-config/.env && grep -q '^DOMAIN=' /var/apps/swarm-config/.env",
      )
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Checking for existing domain configuration..."

    // Try to read existing .env
    const existingEnv = await executeOnHost("cat /var/apps/swarm-config/.env 2>/dev/null || true")
    const domainMatch = existingEnv.stdout.match(/^DOMAIN=(.+)$/m)

    if (domainMatch) {
      yield `Using existing domain: ${domainMatch[1]}`
      return { success: true }
    }

    // Check if domain is provided via environment
    const envDomain = await executeOnHost("echo $SWARM_DOMAIN")
    const domain = envDomain.stdout.trim()

    if (!domain) {
      throw new Error("Domain is required but not provided. Set SWARM_DOMAIN environment variable.")
    }

    yield `Setting domain to: ${domain}`

    // Create directory if it doesn't exist
    await executeOnHost("mkdir -p /var/apps/swarm-config")

    // Append or create .env file
    await executeOnHost(`echo "DOMAIN=${domain}" >> /var/apps/swarm-config/.env`)

    yield `Domain configured: ${domain}`
    return { success: true }
  },
})
