import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  await requireAuth(event)

  const HOST_MANAGER_URL = "http://host-manager:3001"

  try {
    // Simple health check on the host-manager service
    const response = await fetch(`${HOST_MANAGER_URL}/health`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    return {
      available: response.ok,
      status: response.status,
      statusText: response.statusText,
    }
  } catch (error: any) {
    return {
      available: false,
      error: error.message,
      code: error.cause?.code,
    }
  }
})
