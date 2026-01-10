import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "10-prepare-redis",
  name: "Prepare Redis",
  description: "Create and configure Redis data directory",

  async check() {
    try {
      const result = await executeOnHost("test -d /var/apps/swarm-config/redis-data")
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    const workspaceBase = process.env.WORKSPACE_BASE ?? "/var/apps"
    const workDir = `${workspaceBase}/swarm-config`
    const redisDataDir = `${workDir}/redis-data`

    yield "Creating Redis data directory..."
    await executeOnHost(`mkdir -p ${redisDataDir}`)

    yield "Setting Redis directory permissions..."
    try {
      await executeOnHost(`chown -R 1001:1001 "${redisDataDir}"`)
      await executeOnHost(`chmod 755 "${redisDataDir}"`)

      const dumpExists = await executeOnHost(
        `test -f ${redisDataDir}/dump.rdb && echo exists || echo missing`,
      )
      if (dumpExists.stdout.trim() === "exists") {
        await executeOnHost(`chmod 644 "${redisDataDir}/dump.rdb"`)
      }
    } catch (error) {
      yield "⚠️  Could not set Redis permissions (might need adjustment)"
    }

    yield "✓ Redis directory ready"

    return { success: true }
  },
})
