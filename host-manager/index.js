import express from "express"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"

const app = express()
const PORT = 3001

// Read token from Docker secret or environment variable
function getAuthToken() {
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
  if (process.env.HOST_MANAGER_TOKEN) {
    return process.env.HOST_MANAGER_TOKEN
  }

  // Generate temporary token (not recommended for production)
  console.warn("⚠️  No token configured! Generating temporary token.")
  return generateToken()
}

// Generate a secure random token if none provided
function generateToken() {
  return createHash("sha256")
    .update(Date.now().toString() + Math.random().toString())
    .digest("hex")
}

// Environment configuration
const AUTH_TOKEN = getAuthToken()
const SETUP_SCRIPT = process.env.SETUP_SCRIPT || "/app/scripts/setup.sh"

// Token-based authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Missing or invalid authorization header",
    })
  }

  const token = authHeader.substring(7)

  if (token !== AUTH_TOKEN) {
    console.warn(`[${new Date().toISOString()}] Unauthorized access attempt`)
    return res.status(403).json({
      success: false,
      error: "Invalid token",
    })
  }

  next()
}

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "host-manager" })
})

// Update endpoint - executes setup script via privileged container
app.post("/update", authenticate, async (req, res) => {
  console.log(`[${new Date().toISOString()}] Update request received`)

  // Set headers for Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")

  // Helper function to send SSE messages
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    // Execute setup script directly on host using nsenter
    // This enters all host namespaces and runs the script as if on the host
    const docker = spawn("docker", [
      "run",
      "--rm",
      "--privileged",
      "--pid=host",
      "--net=host",
      "--ipc=host",
      "--uts=host",
      "-v",
      "/:/host",
      "alpine:latest",
      "nsenter",
      "--target",
      "1",
      "--mount",
      "--uts",
      "--ipc",
      "--net",
      "--pid",
      "--",
      "bash",
      SETUP_SCRIPT,
    ])

    let stdout = ""
    let stderr = ""

    docker.stdout.on("data", data => {
      const output = data.toString()
      stdout += output
      console.log(output.trim())

      // Send log to client
      sendEvent("log", { message: output })
    })

    docker.stderr.on("data", data => {
      const output = data.toString()
      stderr += output
      console.error(output.trim())

      // Send error log to client
      sendEvent("log", { message: output, level: "error" })
    })

    docker.on("close", code => {
      if (code === 0) {
        console.log(`[${new Date().toISOString()}] Update completed successfully`)
        sendEvent("complete", {
          success: true,
          message: "System update completed successfully",
        })
      } else {
        console.error(`[${new Date().toISOString()}] Update failed with code ${code}`)
        sendEvent("complete", {
          success: false,
          error: `Setup script failed with exit code ${code}`,
          output: stderr || stdout,
        })
      }
      res.end()
    })

    docker.on("error", error => {
      console.error(`[${new Date().toISOString()}] Docker execution error:`, error)
      sendEvent("complete", {
        success: false,
        error: "Failed to execute update",
        details: error.message,
      })
      res.end()
    })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update error:`, error)
    sendEvent("complete", {
      success: false,
      error: "Internal server error",
      details: error.message,
    })
    res.end()
  }
})

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[${new Date().toISOString()}] host-manager listening on port ${PORT}`)
  console.log(`[${new Date().toISOString()}] Auth token: ${AUTH_TOKEN}`)
  if (!process.env.HOST_MANAGER_TOKEN) {
    console.warn(
      `[${new Date().toISOString()}] ⚠️  Using auto-generated token. Set HOST_MANAGER_TOKEN env variable for production!`,
    )
  }
})
