import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Setup host-manager authentication token
 * Creates Docker secret or .env token depending on Swarm mode
 */
export default defineSetupCommand({
  id: "06.5-setup-host-manager-token",
  name: "Setup Host-Manager Token",
  description: "Configure host-manager authentication token (Docker secret or .env)",

  async check() {
    try {
      // Check if token exists as secret or in .env
      const secretCheck = await executeOnHost(
        "docker secret inspect host_manager_token 2>/dev/null",
      )
      if (secretCheck.exitCode === 0) {
        return true
      }

      const envCheck = await executeOnHost(
        "test -f /var/apps/swarm-config/.env && grep -q 'HOST_MANAGER_TOKEN=' /var/apps/swarm-config/.env",
      )
      return envCheck.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Checking Docker Swarm mode..."

    const swarmCheck = await executeOnHost("docker info --format '{{.Swarm.LocalNodeState}}'")
    const isSwarmMode = swarmCheck.stdout.trim() === "active"

    if (isSwarmMode) {
      yield "Docker Swarm detected - setting up secret..."

      // Check if secret exists
      const secretExists = await executeOnHost(
        "docker secret inspect host_manager_token 2>/dev/null",
      )

      if (secretExists.exitCode === 0) {
        yield "  ✓ Secret 'host_manager_token' already exists"
      } else {
        yield "  Creating new token secret..."

        // Generate token
        const tokenResult = await executeOnHost("openssl rand -hex 32")
        const token = tokenResult.stdout.trim()

        // Create secret
        await executeOnHost(`echo "${token}" | docker secret create host_manager_token -`)
        yield "  ✓ Secret 'host_manager_token' created"
      }
    } else {
      yield "Docker Compose mode - checking .env file..."

      const envPath = "/var/apps/swarm-config/.env"
      const envExists = await executeOnHost(`test -f ${envPath} && echo exists || echo missing`)

      if (envExists.stdout.trim() === "exists") {
        const envContent = await executeOnHost(`cat ${envPath}`)

        if (envContent.stdout.includes("HOST_MANAGER_TOKEN=")) {
          yield "  ✓ HOST_MANAGER_TOKEN found in .env file"
        } else {
          yield "  Adding HOST_MANAGER_TOKEN to .env file..."
          const tokenResult = await executeOnHost("openssl rand -hex 32")
          const token = tokenResult.stdout.trim()
          await executeOnHost(`echo "HOST_MANAGER_TOKEN=${token}" >> ${envPath}`)
          yield "  ✓ Token added to .env file"
        }
      } else {
        yield "  Creating .env file with token..."
        await executeOnHost(`mkdir -p /var/apps/swarm-config`)
        const tokenResult = await executeOnHost("openssl rand -hex 32")
        const token = tokenResult.stdout.trim()
        await executeOnHost(`echo "HOST_MANAGER_TOKEN=${token}" > ${envPath}`)
        yield "  ✓ .env file created with token"
      }
    }

    yield "✅ host-manager authentication configured"
    return { success: true }
  },
})
