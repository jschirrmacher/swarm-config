import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Create Kong network for Docker Swarm
 * Creates an overlay network that can be used by Kong and application services
 */
export default defineSetupCommand({
  id: "06-create-network",
  name: "Create Kong Network",
  description: "Create Kong overlay network for Docker Swarm",

  async check() {
    try {
      const result = await executeOnHost(
        "docker network ls --format '{{.Name}}' | grep -x kong-net",
      )
      return result.stdout.trim() === "kong-net"
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Creating kong-net overlay network..."
    await executeOnHost("docker network create --scope=swarm --attachable -d overlay kong-net")

    yield "kong-net network created successfully"
    return { success: true }
  },
})
