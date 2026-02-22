import jwt from "jsonwebtoken"
import type { H3Event } from "h3"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

interface JWTPayload {
  username: string
  iat: number
  exp: number
}

function verifyToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
    return jwt.verify(token, secret) as JWTPayload
  } catch (error) {
    return null
  }
}

export async function getCurrentUser(event?: H3Event) {
  if (event) {
    try {
      const username = getHeader(event, "x-consumer-username")
      if (username) {
        return username
      }
    } catch (error) {
      console.warn("Failed to get username from Kong header:", error)
    }

    try {
      const cookie = getCookie(event, "argus-token")
      if (cookie) {
        const payload = verifyToken(cookie)
        if (payload?.username) {
          return payload.username
        }
      }
    } catch (error) {
      console.warn("Failed to parse JWT token:", error)
    }
  }

  try {
    const { stdout } = await execAsync("whoami")
    return stdout.trim()
  } catch (error) {
    return "unknown"
  }
}

async function getUserFromEvent(event: H3Event) {
  const authHeader = getHeader(event, "authorization")

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7)
    const payload = verifyToken(token)
    if (payload?.username) return payload.username
  }

  const query = getQuery(event)
  const queryToken = query.token as string

  if (queryToken) {
    const payload = verifyToken(queryToken)
    if (payload?.username) return payload.username
  }

  if (process.env.NODE_ENV === "development") {
    try {
      const { stdout } = await execAsync("whoami")
      return stdout.trim()
    } catch (error) {
      console.warn("Failed to get OS user:", error)
      return "developer"
    }
  }

  return null
}

export async function requireAuth(event: H3Event) {
  const username = await getUserFromEvent(event)

  if (!username) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - Invalid or missing token",
    })
  }

  return { username }
}
