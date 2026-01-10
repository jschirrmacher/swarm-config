import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Configure SSH security settings
 * Disables root login and password authentication for enhanced security
 */
export default defineSetupCommand({
  id: "06-configure-ssh",
  name: "Configure SSH Security",
  description: "Disable root login and password authentication for SSH",

  async check() {
    try {
      const result = await executeOnHost(
        "grep -q '^PermitRootLogin no' /etc/ssh/sshd_config && grep -q '^PasswordAuthentication no' /etc/ssh/sshd_config",
      )
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Checking for team users..."

    const teamCheck = await executeOnHost("getent group team")
    if (teamCheck.exitCode !== 0) {
      yield "⚠️  Skipping SSH security (no team users created yet)"
      yield "💡 Run 04-create-users first"
      return { success: true }
    }

    yield "Reading current SSH configuration..."
    const currentConfig = await executeOnHost("cat /etc/ssh/sshd_config")

    yield "Updating SSH security settings..."

    // Create backup
    await executeOnHost("cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup")

    // Disable root login
    await executeOnHost("sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config")

    // Disable password authentication
    await executeOnHost(
      "sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config",
    )

    // Ensure settings are present if not found
    const checkSettings = await executeOnHost(
      "grep -q '^PermitRootLogin' /etc/ssh/sshd_config || echo 'PermitRootLogin no' >> /etc/ssh/sshd_config",
    )

    await executeOnHost(
      "grep -q '^PasswordAuthentication' /etc/ssh/sshd_config || echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config",
    )

    yield "Restarting SSH service..."
    await executeOnHost("service ssh restart")

    yield "✅ SSH security configured"
    yield "⚠️  IMPORTANT: Test team user SSH access before closing root session!"

    return { success: true }
  },
})
