import { requireAuth } from "~/server/utils/auth"
import { readFileSync, existsSync } from "node:fs"

// Read token from Docker secret or environment variable
function getHostManagerToken(): string | null {
  const secretPath = "/run/secrets/host_manager_token"

  // Try Docker secret first (production)
  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim()
    } catch (error) {
      console.error("Failed to read Docker secret:", error)
    }
  }

  // Fall back to environment variable (development)
  return process.env.HOST_MANAGER_TOKEN || null
}

export default defineEventHandler(async event => {
  // Get token from query string (EventSource can't send custom headers)
  const query = getQuery(event)
  const jwtToken = query.token as string

  if (!jwtToken) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - Missing token",
    })
  }

  // Manually verify JWT token
  const { verifyToken } = await import("~/server/utils/auth")
  const payload = verifyToken(jwtToken)

  if (!payload) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - Invalid token",
    })
  }

  const token = getHostManagerToken()

  if (!token) {
    throw createError({
      statusCode: 500,
      message: "HOST_MANAGER_TOKEN not configured",
    })
  }

  try {
    console.log(`[${new Date().toISOString()}] System update request initiated`)

    // Set up Server-Sent Events
    setResponseHeader(event, "Content-Type", "text/event-stream")
    setResponseHeader(event, "Cache-Control", "no-cache")
    setResponseHeader(event, "Connection", "keep-alive")

    // Create fetch with streaming
    const response = await fetch("http://host-manager:3001/update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
