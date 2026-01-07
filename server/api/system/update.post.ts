import { requireAuth } from "~/server/utils/auth"
import { hostManagerFetch } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  // Check if running on Linux
  if (process.platform !== "linux") {
    throw createError({
      statusCode: 400,
      message: "System updates are only available on Linux servers",
    })
  }

  // Require JWT authentication
  const query = getQuery(event)

  // For SSE requests with token in query
  if (!query.token) {
    await requireAuth(event)
  }

  try {
    console.log(`[${new Date().toISOString()}] System update request initiated`)

    // Set up Server-Sent Events
    setResponseHeader(event, "Content-Type", "text/event-stream")
    setResponseHeader(event, "Cache-Control", "no-cache")
    setResponseHeader(event, "Connection", "keep-alive")

    // Create fetch with streaming
    const response = await hostManagerFetch("/update", {
      method: "POST",
    })

    if (!response.body) {
      throw new Error("No response body")
    }

    // Stream the response back to client
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      event.node.res.write(chunk)
    }

    event.node.res.end()
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] System update failed:`, error)

    // Handle different error types
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw createError({
        statusCode: 500,
        message: "Authentication with host-manager failed",
      })
    }

    throw createError({
      statusCode: 500,
      message: "System update failed",
      data: error.message || String(error),
    })
  }
})
