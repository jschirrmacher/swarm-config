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
const STEPS_DIR = process.env.STEPS_DIR || "/var/apps/swarm-config/scripts/steps"

/**
 * Execute a command on the host system using nsenter
 * @param {string} command - The command to run on the host
 * @param {Function} [onOutput] - Optional callback for live output (output, stream)
 * @returns {Promise<string>} - Command output
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

    docker.on("close", code => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`))
      }
    })

    docker.on("error", error => {
      reject(error)
    })
  })
}

/**
 * Get list of step files from host system
 * @returns {Promise<string[]>} - Array of step file paths
 */
async function getStepFilesFromHost() {
  const output = await executeOnHost(`ls -1 ${STEPS_DIR}/*.ts 2>/dev/null | sort`)
  return output
    .trim()
    .split("\n")
    .filter(path => path.length > 0)
}

/**
 * Execute a single step on the host system with live output streaming
 * @param {string} stepPath - Full path to the step file
 * @param {Function} onOutput - Callback for output (stdout/stderr)
 * @returns {Promise<void>}
 */
async function executeStepOnHost(stepPath, onOutput) {
  await executeOnHost(`cd /var/apps/swarm-config && npx tsx ${stepPath}`, onOutput)
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

// Update endpoint - executes setup steps via privileged container
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
    // First, update the repository to get the latest changes
    console.log(`[${new Date().toISOString()}] Pulling latest changes from repository...`)
    sendEvent("log", { message: "Updating repository...\n", level: "info" })

    try {
      await executeOnHost(`cd /var/apps/swarm-config && git pull origin main`, output => {
        console.log(output.trim())
        sendEvent("log", { message: output, level: "info" })
      })
      console.log(`[${new Date().toISOString()}] Repository updated successfully`)
      sendEvent("log", { message: "✓ Repository updated\n\n", level: "info" })
    } catch (gitError) {
      console.warn(
        `[${new Date().toISOString()}] Git pull failed, continuing with existing files:`,
        gitError.message,
      )
      sendEvent("log", {
        message: `⚠️  Could not update repository: ${gitError.message}\n\n`,
        level: "warning",
      })
    }

    // Get all TypeScript step files from host
    const stepFiles = await getStepFilesFromHost()

    if (stepFiles.length === 0) {
      throw new Error(`No step files found in ${STEPS_DIR}`)
    }

    console.log(`[${new Date().toISOString()}] Found ${stepFiles.length} steps to execute`)

    // Execute each step sequentially
    for (const stepPath of stepFiles) {
      const stepName = stepPath.split("/").pop()
      console.log(`[${new Date().toISOString()}] Executing step: ${stepName}`)

      try {
        await executeStepOnHost(stepPath, (output, stream) => {
          if (stream === "stdout") {
            console.log(output.trim())
          } else {
            console.error(output.trim())
          }
          sendEvent("log", { message: output, level: stream === "stderr" ? "error" : "info" })
        })

        console.log(`[${new Date().toISOString()}] Step ${stepName} completed successfully`)
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Step ${stepName} failed:`, error.message)
        throw new Error(`Step ${stepName} failed: ${error.message}`)
      }
    }

    // All steps completed successfully
    console.log(`[${new Date().toISOString()}] All steps completed successfully`)
    sendEvent("complete", {
      success: true,
      message: "System update completed successfully",
    })
    res.end()
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update error:`, error)
    sendEvent("complete", {
      success: false,
      error: error.message || "Update failed",
      details: error.stack,
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
