import { requireAuth } from "~/server/utils/auth"
import { executeOnHost } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  await requireAuth(event)

  const body = await readBody(event)

  if (!body.host || !body.user) {
    throw createError({
      statusCode: 400,
      message: "SMTP Host and User are required",
    })
  }

  const { host, port = "587", user, password, from, tls = true } = body

  try {
    const msmtpConfigPath = "/etc/msmtprc"
    let finalPassword = password

    if (!finalPassword) {
      try {
        const checkResult = await executeOnHost(
          `test -f ${msmtpConfigPath} && echo "exists" || echo "not_found"`,
        )

        if (checkResult.stdout.trim() === "exists") {
          const configResult = await executeOnHost(`cat ${msmtpConfigPath}`)
          const passwordMatch = configResult.stdout.match(/^password\s+(.+)$/m)
          if (passwordMatch?.[1]) {
            finalPassword = passwordMatch[1]
          }
        }
      } catch {}
    }

    if (!finalPassword) {
      throw createError({
        statusCode: 400,
        message: "Password is required",
      })
    }

    try {
      await executeOnHost("command -v msmtp")
    } catch {
      throw createError({
        statusCode: 500,
        message:
          "msmtp is not installed. Please run the setup script or install msmtp manually: apt-get install -y msmtp msmtp-mta",
      })
    }

    const fromAddress = from || user
    const useTls = tls !== false

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
password       ${finalPassword}
`

    await executeOnHost(`cat > ${msmtpConfigPath} << 'EOF'
${msmtpConfig}
EOF
chmod 600 ${msmtpConfigPath}`)

    await executeOnHost(`
      touch /var/log/msmtp.log
      chmod 666 /var/log/msmtp.log
    `)

    await executeOnHost(`
      if [ ! -f /usr/sbin/sendmail ]; then
        ln -s /usr/bin/msmtp /usr/sbin/sendmail
      fi
    `)

    return {
      success: true,
      message: "SMTP configuration saved successfully",
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to save SMTP configuration",
    })
  }
})
