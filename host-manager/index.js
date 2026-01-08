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

// Get SMTP configuration from host
app.get("/smtp", authenticate, async (req, res) => {
  console.log(`[${new Date().toISOString()}] SMTP GET request received`)

  try {
    const msmtpConfigPath = "/etc/msmtprc"

    // Check if config file exists
    const checkExists = await executeOnHost(
      `test -f ${msmtpConfigPath} && echo "exists" || echo "not_found"`,
    )

    if (checkExists.trim() === "not_found") {
      return res.json({ configured: false })
    }

    // Read and parse config
    const config = await executeOnHost(`cat ${msmtpConfigPath}`)

    const hostMatch = config.match(/^host\s+(.+)$/m)
    const portMatch = config.match(/^port\s+(.+)$/m)
    const userMatch = config.match(/^user\s+(.+)$/m)
    const fromMatch = config.match(/^from\s+(.+)$/m)
    const tlsMatch = config.match(/^tls\s+(.+)$/m)

    res.json({
      configured: true,
      host: hostMatch?.[1] || "",
      port: portMatch?.[1] || "587",
      user: userMatch?.[1] || "",
      from: fromMatch?.[1] || "",
      tls: tlsMatch?.[1] !== "off",
    })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] SMTP GET error:`, error)
    res.status(500).json({
      success: false,
      error: `Failed to read SMTP configuration: ${error.message}`,
    })
  }
})

// Save SMTP configuration on host
app.post("/smtp", authenticate, express.json(), async (req, res) => {
  console.log(`[${new Date().toISOString()}] SMTP POST request received`)

  const { host, port = "587", user, password, from, tls = true } = req.body

  // Validate required fields
  if (!host || !user) {
    return res.status(400).json({
      success: false,
      error: "SMTP Host and User are required",
    })
  }

  try {
    const msmtpConfigPath = "/etc/msmtprc"
    let finalPassword = password

    // If password is empty, try to keep existing one
    if (!finalPassword) {
      const checkExists = await executeOnHost(
        `test -f ${msmtpConfigPath} && echo "exists" || echo "not_found"`,
      )

      if (checkExists.trim() === "exists") {
        const existingConfig = await executeOnHost(`cat ${msmtpConfigPath}`)
        const passwordMatch = existingConfig.match(/^password\s+(.+)$/m)
        if (passwordMatch?.[1]) {
          finalPassword = passwordMatch[1]
        }
      }
    }

    if (!finalPassword) {
      return res.status(400).json({
        success: false,
        error: "Password is required",
      })
    }

    const fromAddress = from || user
    const useTls = tls !== false

    // Install msmtp if not present (on the host system)
    await executeOnHost(`
      if ! command -v msmtp &> /dev/null; then
        echo "Installing msmtp on host system..."
        export DEBIAN_FRONTEND=noninteractive
        
        # Ensure software-properties-common is installed
        apt-get update -qq
        apt-get install -y -qq software-properties-common
        
        # Add universe repository if not present
        if ! grep -q "^deb.*universe" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
          add-apt-repository -y universe || echo "Universe repository already configured"
        fi
        
        # Update and install msmtp
        apt-get update -qq
        apt-get install -y -qq msmtp msmtp-mta || {
          echo "Failed to install msmtp packages"
          exit 1
        }
      fi
    `)

    // Create config file content
    const msmtpConfig = `# msmtp configuration for swarm-config
defaults
auth           on
tls            ${useTls ? "on" : "off"}
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile        /var/log/msmtp.log

# SMTP account configuration
account        default
host           ${host}
port           ${port}
from           ${fromAddress}
user           ${user}
password       ${finalPassword}
`

    // Write config file
    await executeOnHost(`cat > ${msmtpConfigPath} << 'EOF'
${msmtpConfig}
EOF
chmod 600 ${msmtpConfigPath}`)

    // Create log file with proper permissions
    await executeOnHost(`
      touch /var/log/msmtp.log
      chmod 666 /var/log/msmtp.log
    `)

    // Create symlink for sendmail compatibility if needed
    await executeOnHost(`
      if [ ! -f /usr/sbin/sendmail ]; then
        ln -s /usr/bin/msmtp /usr/sbin/sendmail
      fi
    `)

    console.log(`[${new Date().toISOString()}] SMTP configuration saved successfully`)
    res.json({
      success: true,
      message: "SMTP configuration saved successfully",
    })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] SMTP POST error:`, error)
    res.status(500).json({
      success: false,
      error: `Failed to save SMTP configuration: ${error.message}`,
    })
  }
})
