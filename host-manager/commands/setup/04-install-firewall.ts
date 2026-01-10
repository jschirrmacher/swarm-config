import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Install and configure UFW firewall
 * Configures firewall with necessary ports for web services
 */
export default defineSetupCommand({
  id: "04-install-firewall",
  name: "Configure Firewall",
  description: "Install and configure UFW firewall with required ports",

  async check() {
    try {
      const result = await executeOnHost("ufw status | grep -q 'Status: active'")
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Installing UFW firewall..."
    await executeOnHost("DEBIAN_FRONTEND=noninteractive apt-get install -y ufw")

    yield "Configuring firewall rules..."
    yield "  Allowing SSH (port 22)..."
    await executeOnHost("ufw allow ssh")

    yield "  Allowing HTTP (port 80)..."
    await executeOnHost("ufw allow http")

    yield "  Allowing HTTPS (port 443)..."
    await executeOnHost("ufw allow https")

    yield "Enabling firewall..."
    await executeOnHost("ufw --force enable")

    yield "UFW Firewall configured (ports: 22, 80, 443)"
    return { success: true }
  },
})
