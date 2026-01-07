import { requireAuth } from "~/server/utils/auth"
import { hostManagerRequest } from "~/server/utils/hostManager"

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
    return await hostManagerRequest("/smtp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to save SMTP configuration",
    })
  }
})
