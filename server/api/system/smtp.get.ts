import { requireAuth } from "~/server/utils/auth"
import { executeOnHost } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  await requireAuth(event)

  try {
    const msmtpConfigPath = "/etc/msmtprc"

    const checkResult = await executeOnHost(
      `test -f ${msmtpConfigPath} && echo "exists" || echo "not_found"`,
    )

    if (checkResult.stdout.trim() === "not_found") {
      return { configured: false }
    }

    const configResult = await executeOnHost(`cat ${msmtpConfigPath}`)
    const config = configResult.stdout

    const hostMatch = config.match(/^host\s+(.+)$/m)
    const portMatch = config.match(/^port\s+(.+)$/m)
    const userMatch = config.match(/^user\s+(.+)$/m)
    const fromMatch = config.match(/^from\s+(.+)$/m)
    const tlsMatch = config.match(/^tls\s+(.+)$/m)

    return {
      configured: true,
      host: hostMatch?.[1] || "",
      port: portMatch?.[1] || "587",
      user: userMatch?.[1] || "",
      from: fromMatch?.[1] || "",
      tls: tlsMatch?.[1] !== "off",
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to read SMTP configuration",
    })
  }
})
