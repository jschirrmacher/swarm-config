import { requireAuth } from "~/server/utils/auth"
import { smtpRead, smtpWrite } from "~/server/utils/hostManager"

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
    let finalPassword = password

    if (!finalPassword) {
      try {
        const existingConfig = await smtpRead()
        if (existingConfig.configured && existingConfig.config) {
          const passwordMatch = existingConfig.config.match(/^password\s+(.+)$/m)
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

    const result = await smtpWrite({
      host,
      port,
      user,
      password: finalPassword,
      from,
      tls,
    })

    return result
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to save SMTP configuration",
    })
  }
})
