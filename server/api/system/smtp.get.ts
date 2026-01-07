import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  // Authenticate the request
  await requireAuth(event)

  try {
    // Get host-manager token from environment
    const hostManagerToken = process.env.HOST_MANAGER_TOKEN

    if (!hostManagerToken) {
      throw createError({
        statusCode: 500,
        message: "Host manager token not configured",
      })
    }

    // Call host-manager API
    const response = await fetch("http://host-manager:3001/smtp", {
      headers: {
        Authorization: `Bearer ${hostManagerToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw createError({
        statusCode: response.status,
        message: error.error || "Failed to fetch SMTP configuration",
      })
    }

    return await response.json()
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to read SMTP configuration",
    })
  }
})
