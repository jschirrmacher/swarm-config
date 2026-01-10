import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "10-deploy-kong",
  name: "Prepare Kong Gateway",
  description: "Prepare Kong API Gateway configuration and Redis data directory",

  async check() {
    try {
      const result = await executeOnHost(
        "test -d /var/apps/swarm-config/redis-data && test -f /var/apps/swarm-config/generated/kong.yaml",
      )
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

    yield "Generating Kong configuration..."
    // Run inside container using mounted workspace
    const { execSync } = await import("child_process")

    try {
      // Ensure dependencies are installed
      yield "  Installing dependencies..."
      const installOutput = execSync(`cd ${workDir} && npm install`, {
        encoding: "utf-8",
        env: { ...process.env },
      })
      if (installOutput) {
        yield `  ${installOutput.trim()}`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      yield `  ⚠️  npm install output: ${errorMessage}`
    }

    try {
      // Generate Kong config
      yield "  Generating config file..."
      const output = execSync(`cd ${workDir} && npx tsx src/generate-kong-config.ts`, {
        encoding: "utf-8",
        env: {
          ...process.env,
          WORKSPACE_BASE: workspaceBase,
        },
      })
      if (output) {
        yield `  ${output.trim()}`
      }

      // Verify file was created
      const { existsSync } = await import("fs")
      if (!existsSync(`${workDir}/generated/kong.yaml`)) {
        throw new Error("kong.yaml was not generated")
      }

      yield "  ✓ kong.yaml generated successfully"
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate Kong configuration: ${errorMessage}`)
    }

    yield "✓ Kong preparation complete"
    yield "  (Kong will be deployed with Web UI)"

    return { success: true }
  },
})
