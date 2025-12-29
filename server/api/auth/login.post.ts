import jwt from "jsonwebtoken"
import type { H3Event } from "h3"

export default defineEventHandler(async (event: H3Event) => {
  // Kong has already validated Basic Auth
  // Get the authenticated username from Kong's header
  const username = getHeader(event, "x-consumer-username")

  if (!username) {
    throw createError({
      statusCode: 401,
      message: "Authentication failed - no user information from Kong",
    })
  }

  // Generate JWT token for frontend
  const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
  const token = jwt.sign({ username }, secret, { expiresIn: "7d" })

  return {
    token,
    username,
    expiresIn: "7d",
  }
})
