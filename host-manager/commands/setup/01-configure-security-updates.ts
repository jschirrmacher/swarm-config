import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Example setup command: Configure automatic security updates
 * This demonstrates the setup command pattern
 */
export default defineSetupCommand({
  id: "01-configure-security-updates",
  name: "Configure Security Updates",
  description: "Enable automatic security updates via unattended-upgrades",

  async check() {
    try {
      const result = await executeOnHost("dpkg -l unattended-upgrades")
      return result.stdout.includes("unattended-upgrades")
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Installing unattended-upgrades package..."
    await executeOnHost("apt-get update")
    await executeOnHost("DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades")

    yield "Configuring automatic updates..."
    await executeOnHost(
      'echo "APT::Periodic::Update-Package-Lists \\"1\\";" > /etc/apt/apt.conf.d/20auto-upgrades',
    )
    await executeOnHost(
      'echo "APT::Periodic::Unattended-Upgrade \\"1\\";" >> /etc/apt/apt.conf.d/20auto-upgrades',
    )

    yield "Restarting unattended-upgrades service..."
    await executeOnHost("systemctl restart unattended-upgrades")

    yield "Security updates configured successfully"
    return { success: true }
  },
})
