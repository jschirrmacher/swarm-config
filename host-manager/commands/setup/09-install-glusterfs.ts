import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "09-install-glusterfs",
  name: "Install GlusterFS",
  description: "Install GlusterFS for multi-node distributed storage (optional)",

  async check() {
    try {
      const result = await executeOnHost("systemctl is-active glusterd")
      return result.stdout.trim() === "active"
    } catch {
      return false
    }
  },

  async *execute() {
    const envPath = "/var/apps/swarm-config/.env"

    yield "Checking installation preference..."

    const envExists = await executeOnHost(`test -f ${envPath} && cat ${envPath} || echo ""`)
    const installMatch = envExists.stdout.match(/^INSTALL_GLUSTERFS=(.+)$/m)
    let installGlusterFS = installMatch ? installMatch[1] : undefined

    if (!installGlusterFS) {
      yield "No preference saved in .env"
      yield "GlusterFS is needed for multi-node clusters with distributed storage"
      yield "For single-node setups, you can skip this"
      yield ""
      yield "⏭️  Skipping GlusterFS (can be installed later via UI)"

      await executeOnHost(`echo "INSTALL_GLUSTERFS=false" >> ${envPath}`)
      return { success: true }
    }

    yield `Using saved preference: INSTALL_GLUSTERFS=${installGlusterFS}`

    if (installGlusterFS === "true") {
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
