import express from "express"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"

const app = express()
const PORT = 3001

// Read token from Docker secret or environment variable
function getAuthToken() {
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

/**
 * Execute a command on the host system using nsenter
 * @param {string} command - The command to run on the host
 * @param {Function} [onOutput] - Optional callback for live output (output, stream)
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function executeOnHost(command, onOutput) {
  return new Promise((resolve, reject) => {
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
      "-c",
      command,
    ])

    let stdout = ""
    let stderr = ""

    docker.stdout.on("data", data => {
      const output = data.toString()
      stdout += output
      if (onOutput) {
        onOutput(output, "stdout")
      }
    })

    docker.stderr.on("data", data => {
      const output = data.toString()
      stderr += output
      if (onOutput) {
        onOutput(output, "stderr")
      }
    })

    docker.on("close", exitCode => {
      resolve({ stdout, stderr, exitCode })
    })

    docker.on("error", error => {
      reject(error)
    })
  })
}

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

// Generic command execution endpoint
app.post("/exec", authenticate, express.json(), async (req, res) => {
  const { command, stream = false } = req.body

  if (!command) {
    return res.status(400).json({
      success: false,
      error: "Command is required",
    })
  }

  console.log(`[${new Date().toISOString()}] Executing command: ${command.substring(0, 100)}...`)

  try {
    if (stream) {
      // Set headers for Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream")
      res.setHeader("Cache-Control", "no-cache")
      res.setHeader("Connection", "keep-alive")

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      const result = await executeOnHost(command, (output, stream) => {
        sendEvent("output", { stream, data: output })
      })

      sendEvent("complete", {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      })

      res.end()
    } else {
      // Regular request/response
      const result = await executeOnHost(command)

      if (result.exitCode === 0) {
        res.json({
          success: true,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        })
      } else {
        res.status(500).json({
          success: false,
          error: `Command failed with exit code ${result.exitCode}`,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        })
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Execution error:`, error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[${new Date().toISOString()}] host-manager listening on port ${PORT}`)
  console.log(`[${new Date().toISOString()}] Auth token configured: ${!!AUTH_TOKEN}`)
  if (!process.env.HOST_MANAGER_TOKEN && !existsSync("/run/secrets/host_manager_token")) {
    console.warn(
      `[${new Date().toISOString()}] ⚠️  Using auto-generated token. Set HOST_MANAGER_TOKEN env variable for production!`,
    )
  }
})
