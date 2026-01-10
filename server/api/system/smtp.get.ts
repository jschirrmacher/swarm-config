import { requireAuth } from "~/server/utils/auth"
import { smtpRead } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  await requireAuth(event)

  try {
    const result = await smtpRead()

    if (!result.config) {
      return { configured: false }
    }

    return {
      configured: true,
      ...result.config,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to read SMTP configuration",
    })
  }
})
