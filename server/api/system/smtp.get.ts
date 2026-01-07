import { requireAuth } from "~/server/utils/auth"
import { hostManagerRequest } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  // Authenticate the request
  await requireAuth(event)

  try {
    return await hostManagerRequest("/smtp")
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to read SMTP configuration",
    })
  }
})
