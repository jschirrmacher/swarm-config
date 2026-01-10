import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "12-install-glusterfs",
  name: "Install GlusterFS",
  description: "Install GlusterFS for multi-node distributed storage (optional)",
  manualOnly: true,

  inputs: [
    {
      name: "installGlusterFS",
      label: "Install GlusterFS?",
      type: "boolean",
      default: false,
      description:
        "GlusterFS is needed for multi-node clusters with distributed storage. For single-node setups, you can skip this.",
    },
  ],

  async getInputValues() {
    try {
      const envPath = "/var/apps/swarm-config/.env"
      const envContent = (await executeOnHost(`cat ${envPath} 2>/dev/null || true`)).stdout
      const match = envContent.match(/^INSTALL_GLUSTERFS=(.+)$/m)

      if (match) {
        return {
          installGlusterFS: match[1] === "true",
        }
      }
    } catch {
      // Ignore errors, return empty
    }
    return {}
  },

  async check() {
    try {
      const result = await executeOnHost("systemctl is-active glusterd")
      return result.stdout.trim() === "active"
    } catch {
      return false
    }
  },

  async *execute(inputs?: Record<string, any>) {
    const envPath = "/var/apps/swarm-config/.env"
    const installGlusterFS = inputs?.installGlusterFS === true

    yield `User choice: ${installGlusterFS ? "Install" : "Skip"} GlusterFS`

    await executeOnHost(`echo "INSTALL_GLUSTERFS=${installGlusterFS}" >> ${envPath}`)

    if (installGlusterFS) {
      yield "Installing GlusterFS..."
      await executeOnHost("DEBIAN_FRONTEND=noninteractive apt-get install -y glusterfs-server")

      yield "Enabling GlusterFS service..."
      await executeOnHost("systemctl enable glusterd")
      await executeOnHost("systemctl start glusterd")

      yield "✅ GlusterFS installed and started"
      yield "ℹ️  See docs/MULTI-NODE-SETUP.md for cluster configuration"
    } else {
      yield "⏭️  Skipping GlusterFS installation"
    }

    return { success: true }
  },
})
