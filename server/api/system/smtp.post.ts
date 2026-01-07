import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  // Authenticate the request
  await requireAuth(event)

  const body = await readBody(event)

  // Validate required fields
  if (!body.host || !body.user) {
    throw createError({
      statusCode: 400,
      message: "SMTP Host and User are required",
    })
  }

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
      method: "POST",
      headers: {
        Authorization: `Bearer ${hostManagerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      throw createError({
        statusCode: response.status,
        message: error.error || "Failed to save SMTP configuration",
      })
    }

    return await response.json()
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to save SMTP configuration",
    })
  }
})
