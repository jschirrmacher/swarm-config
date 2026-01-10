import { defineCommand } from "../lib/defineCommand.js"
import { executeOnHost } from "../lib/execute.js"

interface SmtpConfig {
  host: string
  port?: string
  user: string
  password: string
  from?: string
  tls?: boolean
}

export default defineCommand(
  "Write SMTP configuration to /etc/msmtprc",
  "POST",
  "/smtp",
  async req => {
    const { host, port = "587", user, password, from, tls = true } = req.body as SmtpConfig

    if (!host || !user || !password) {
      throw new Error("Missing required fields: host, user, password")
    }

    // Validate inputs
    if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
      throw new Error("Invalid host format")
    }

    const portNum = typeof port === "string" ? parseInt(port, 10) : port
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error("Invalid port number")
    }

    const fromAddress = from || user
    const useTls = tls !== false

    // Verify msmtp is installed
    const msmtpCheck = await executeOnHost("command -v msmtp")
    if (!msmtpCheck.success) {
      throw new Error("msmtp is not installed")
    }

    const msmtpConfigPath = "/etc/msmtprc"

    // Create config content (password is already in the string, no additional escaping needed for heredoc)
    const msmtpConfig = `# msmtp configuration for swarm-config
defaults
auth           on
tls            ${useTls ? "on" : "off"}
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile        /var/log/msmtp.log

# SMTP account configuration
account        default
host           ${host}
port           ${port}
from           ${fromAddress}
user           ${user}
password       ${password}
`

    // Write config file and set permissions
    const writeResult = await executeOnHost(`cat > ${msmtpConfigPath} << 'EOF'
${msmtpConfig}
EOF
chmod 600 ${msmtpConfigPath}`)

    if (!writeResult.success) {
      throw new Error("Failed to write SMTP configuration")
    }

    // Create log file
    await executeOnHost(`
    touch /var/log/msmtp.log
    chmod 666 /var/log/msmtp.log
  `)

    // Create sendmail symlink
    await executeOnHost(`
    if [ ! -f /usr/sbin/sendmail ]; then
      ln -s /usr/bin/msmtp /usr/sbin/sendmail
    fi
  `)

    return {
      success: true,
      message: "SMTP configuration saved successfully",
    }
  },
)
