import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "09.5-configure-smtp",
  name: "Configure SMTP",
  description: "Configure SMTP settings for email notifications",
  manualOnly: true,

  inputs: [
    {
      name: "smtpHost",
      label: "SMTP Host",
      type: "text",
      required: true,
      description: "SMTP server hostname (e.g., smtp.gmail.com)",
    },
    {
      name: "smtpPort",
      label: "SMTP Port",
      type: "text",
      required: false,
      default: "587",
      description: "SMTP port (default: 587 for TLS)",
    },
    {
      name: "smtpUser",
      label: "SMTP User",
      type: "text",
      required: true,
      description: "SMTP username (usually your email address)",
    },
    {
      name: "smtpPassword",
      label: "SMTP Password",
      type: "password",
      required: true,
      description: "SMTP password or app-specific password",
    },
    {
      name: "smtpFrom",
      label: "From Address",
      type: "text",
      required: true,
      description: "Email address to send from",
    },
  ],

  async getInputValues() {
    try {
      const envContent = await executeOnHost("cat /var/apps/swarm-config/.env 2>/dev/null || true")
      const env = envContent.stdout

      const getValue = (key: string) => {
        const match = env.match(new RegExp(`${key}=(.+)`))
        return match ? match[1].trim() : ""
      }

      return {
        smtpHost: getValue("SMTP_HOST"),
        smtpPort: getValue("SMTP_PORT") || "587",
        smtpUser: getValue("SMTP_USER"),
        smtpPassword: getValue("SMTP_PASSWORD"),
        smtpFrom: getValue("SMTP_FROM"),
      }
    } catch {
      return {}
    }
  },

  async check() {
    try {
      const envContent = await executeOnHost("cat /var/apps/swarm-config/.env 2>/dev/null || true")
      const env = envContent.stdout

      // Check if all required SMTP settings are present
      const hasHost = env.includes("SMTP_HOST=") && !env.match(/SMTP_HOST=\s*$/m)
      const hasUser = env.includes("SMTP_USER=") && !env.match(/SMTP_USER=\s*$/m)
      const hasPassword = env.includes("SMTP_PASSWORD=") && !env.match(/SMTP_PASSWORD=\s*$/m)
      const hasFrom = env.includes("SMTP_FROM=") && !env.match(/SMTP_FROM=\s*$/m)

      return hasHost && hasUser && hasPassword && hasFrom
    } catch {
      return false
    }
  },

  async *execute(inputs) {
    if (!inputs) {
      throw new Error("SMTP configuration inputs are required")
    }

    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom } = inputs

    if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
      throw new Error("All SMTP fields (host, user, password, from) are required")
    }

    yield "📧 Configuring SMTP settings..."

    const envFile = "/var/apps/swarm-config/.env"

    // Read current .env file
    const currentEnv = await executeOnHost(`cat ${envFile} 2>/dev/null || true`)
    let envLines = currentEnv.stdout.split("\n")

    // Update or add SMTP settings
    const updateOrAdd = (key: string, value: string) => {
      const index = envLines.findIndex(line => line.startsWith(`${key}=`))
      const newLine = `${key}=${value}`
      if (index >= 0) {
        envLines[index] = newLine
      } else {
        envLines.push(newLine)
      }
    }

    updateOrAdd("SMTP_HOST", smtpHost)
    updateOrAdd("SMTP_PORT", smtpPort || "587")
    updateOrAdd("SMTP_USER", smtpUser)
    updateOrAdd("SMTP_PASSWORD", smtpPassword)
    updateOrAdd("SMTP_FROM", smtpFrom)

    // Write back to .env
    const newEnvContent = envLines.filter(line => line.trim()).join("\n") + "\n"
    await executeOnHost(`cat > ${envFile} << 'ENVEOF'
${newEnvContent}
ENVEOF`)

    yield "✅ SMTP configuration saved to .env file"

    // Test SMTP configuration using msmtp if available
    try {
      const msmtpInstalled = await executeOnHost("which msmtp 2>/dev/null || echo 'not-found'")

      if (!msmtpInstalled.stdout.includes("not-found")) {
        yield "🔍 Testing SMTP connection..."

        // Create temporary msmtp config for testing
        await executeOnHost(`cat > /tmp/msmtprc-test << 'MSMTPEOF'
defaults
auth           on
tls            on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile        ~/.msmtp.log

account        test
host           ${smtpHost}
port           ${smtpPort || "587"}
from           ${smtpFrom}
user           ${smtpUser}
password       ${smtpPassword}

account default : test
MSMTPEOF`)

        // Try to verify connection (this will fail if credentials are wrong)
        const testResult = await executeOnHost(
          `echo "Test" | msmtp -C /tmp/msmtprc-test --serverinfo 2>&1 || true`,
        )

        await executeOnHost("rm -f /tmp/msmtprc-test")

        if (
          testResult.stdout.includes("successfully") ||
          testResult.stdout.includes("SMTP server")
        ) {
          yield "✅ SMTP connection test successful"
        } else {
          yield "⚠️  SMTP configuration saved, but connection test inconclusive"
          yield "   You may want to verify settings manually"
        }
      }
    } catch {
      yield "ℹ️  SMTP configuration saved (connection test skipped)"
    }

    yield "📧 SMTP configured successfully"
    return { success: true }
  },
})
