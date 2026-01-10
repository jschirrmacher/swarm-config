import { defineCommand } from "../lib/defineCommand.js"
import { executeOnHost } from "../lib/execute.js"

export default defineCommand(
  "Read SMTP configuration from /etc/msmtprc",
  "GET",
  "/smtp",
  async () => {
    const msmtpConfigPath = "/etc/msmtprc"

    const checkResult = await executeOnHost(
      `test -f ${msmtpConfigPath} && echo "exists" || echo "not_found"`,
    )

    if (checkResult.stdout.trim() === "not_found") {
      return {}
    }

    const configResult = await executeOnHost(`cat ${msmtpConfigPath}`)

    if (!configResult.success) {
      throw new Error("Failed to read SMTP configuration")
    }

    const configText = configResult.stdout
    const hostMatch = configText.match(/^host\s+(.+)$/m)
    const portMatch = configText.match(/^port\s+(.+)$/m)
    const userMatch = configText.match(/^user\s+(.+)$/m)
    const fromMatch = configText.match(/^from\s+(.+)$/m)
    const tlsMatch = configText.match(/^tls\s+(.+)$/m)

    return {
      config: {
        host: hostMatch?.[1] || "",
        port: portMatch?.[1] || "587",
        user: userMatch?.[1] || "",
        from: fromMatch?.[1] || "",
        tls: tlsMatch?.[1] !== "off",
      },
    }
  },
)
