import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Prepare apps directory structure
 * Creates /var/apps and sets up basic structure for application deployments
 */
export default defineSetupCommand({
  id: "10-prepare-apps",
  name: "Prepare Apps Directory",
  description: "Create /var/apps directory structure for application deployments",

  async check() {
    try {
      const result = await executeOnHost("test -d /var/apps && test -d /home")
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Creating workspace directories..."

    const workspaceBase = "/var/apps"
    const reposBase = "/home"

    // Create base directories
    await executeOnHost(`mkdir -p ${workspaceBase}`)
    await executeOnHost(`mkdir -p ${reposBase}`)

    yield `Workspace created at: ${workspaceBase}`
    yield `Git repos directory: ${reposBase}`

    // Set default git branch name
    yield "Configuring git defaults..."
    await executeOnHost("git config --global init.defaultBranch main")

    // Create swarm-config directory
    const swarmConfigDir = `${workspaceBase}/swarm-config`
    await executeOnHost(`mkdir -p ${swarmConfigDir}`)
    yield `Swarm config directory: ${swarmConfigDir}`

    yield "Apps directory structure prepared successfully"
    return { success: true }
  },
})
