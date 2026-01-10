import express, { Request, Response, NextFunction } from "express"
import { createHash } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import systemUpdate from "./commands/systemUpdate.js"
import smtpRead from "./commands/smtpRead.js"
import smtpWrite from "./commands/smtpWrite.js"

const app = express()
const PORT = 3001

function getAuthToken(): string {
  const secretPath = "/run/secrets/host_manager_token"

  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim()
    } catch (error) {
      console.error("Failed to read Docker secret:", error)
    }
  }

  if (process.env.HOST_MANAGER_TOKEN) {
    return process.env.HOST_MANAGER_TOKEN
  }

  console.warn("⚠️  No token configured! Generating temporary token.")
  return createHash("sha256")
    .update(Date.now().toString() + Math.random().toString())
    .digest("hex")
}

const AUTH_TOKEN = getAuthToken()

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Missing or invalid authorization header",
    })
    return
  }

  const token = authHeader.substring(7)

  if (token !== AUTH_TOKEN) {
    console.warn(`[${new Date().toISOString()}] Unauthorized access attempt`)
    res.status(403).json({
      success: false,
      error: "Invalid token",
    })
    return
  }

  next()
}

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "host-manager" })
})

const commands = [systemUpdate, smtpRead, smtpWrite]
const jsonParser = express.json()

commands.forEach(command => command(app, authenticate, jsonParser))

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[${new Date().toISOString()}] host-manager listening on port ${PORT}`)
  console.log(`[${new Date().toISOString()}] Auth token configured: ${!!AUTH_TOKEN}`)
  if (!process.env.HOST_MANAGER_TOKEN && !existsSync("/run/secrets/host_manager_token")) {
    console.warn(
      `[${new Date().toISOString()}] ⚠️  Using auto-generated token. Set HOST_MANAGER_TOKEN env variable for production!`,
    )
  }
})
