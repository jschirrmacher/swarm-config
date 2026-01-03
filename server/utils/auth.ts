import jwt from "jsonwebtoken"
import type { H3Event } from "h3"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export interface JWTPayload {
  username: string
  iat: number
  exp: number
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
    return jwt.verify(token, secret) as JWTPayload
  } catch (error) {
    return null
  }
}

export function getUserFromEvent(event: H3Event): string | null {
  // Get token from Authorization header
  const authHeader = getHeader(event, "authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.substring(7)
  const payload = verifyToken(token)

  return payload?.username || null
}

export async function requireAuth(event: H3Event): Promise<string> {
  // In development mode, use OS user as fallback
  if (process.env.NODE_ENV === "development") {
    const username = getUserFromEvent(event)

    if (username) {
      return username
    }

    // Fallback to OS user in development
    try {
      const { stdout } = await execAsync("whoami")
      return stdout.trim()
    } catch (error) {
      console.warn("Failed to get OS user:", error)
      return "developer"
    }
  }

  // Production mode: require JWT token
  const username = getUserFromEvent(event)

  if (!username) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized - Invalid or missing token",
    })
  }

  return username
}
