import { defineSetupCommand } from "../../lib/defineSetupCommand.js"

export default defineSetupCommand({
  id: "10.5-generate-kong-config",
  name: "Generate Kong Configuration",
  description: "Generate Kong Gateway configuration from all project kong.yaml files",

  async check() {
    // Always regenerate to pick up any changes
    return false
  },

  async *execute() {
    const workspaceBase = process.env.WORKSPACE_BASE ?? "/var/apps"
    const workDir = `${workspaceBase}/swarm-config`

    yield "Installing dependencies..."
    const { execSync } = await import("child_process")

    try {
      const installOutput = execSync(`cd ${workDir} && npm install`, {
        encoding: "utf-8",
        env: { ...process.env },
      })
      if (installOutput) {
        yield `  ${installOutput.trim()}`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      yield `  ⚠️  npm install: ${errorMessage}`
    }

    yield "Generating Kong configuration..."
    try {
      const output = execSync(`cd ${workDir} && npx tsx src/generate-kong-config.ts`, {
        encoding: "utf-8",
        env: {
          ...process.env,
          WORKSPACE_BASE: workspaceBase,
        },
      })
      if (output) {
        yield `${output.trim()}`
      }

      // Verify file was created
      const { existsSync } = await import("fs")
      if (!existsSync(`${workDir}/generated/kong.yaml`)) {
        throw new Error("kong.yaml was not generated")
      }

      yield "✓ Kong configuration generated successfully"
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate Kong configuration: ${errorMessage}`)
    }

    return { success: true }
  },
})
