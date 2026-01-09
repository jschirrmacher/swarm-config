import { readFileSync, existsSync } from "node:fs"

const HOST_MANAGER_URL = "http://host-manager:3001"

interface ExecuteResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  error?: string
}

function getHostManagerToken() {
  const secretPath = "/run/secrets/host_manager_token"

  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim()
    } catch (error) {
      console.error("Failed to read host_manager_token secret:", error)
    }
  }

  const token = process.env.HOST_MANAGER_TOKEN
  if (!token) {
    throw createError({
      statusCode: 500,
      message: "Host manager token not configured",
    })
  }

  return token
}

function createHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

async function makeRequest(command: string, stream: boolean) {
  const token = getHostManagerToken()

  return fetch(`${HOST_MANAGER_URL}/exec`, {
    method: "POST",
    headers: createHeaders(token),
    body: JSON.stringify({ command, stream }),
  })
}

export async function executeOnHost(command: string): Promise<ExecuteResult> {
  const response = await makeRequest(command, false)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: error.error || `Host manager request failed: ${response.statusText}`,
    })
  }

  const result: ExecuteResult = await response.json()

  if (!result.success) {
    throw createError({
      statusCode: 500,
      message: result.error || "Command execution failed",
      data: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
    })
  }

  return result
}

export async function executeOnHostStreaming(target: NodeJS.WritableStream, command: string) {
  const response = await makeRequest(command, true)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: error.error || `Host manager request failed: ${response.statusText}`,
    })
  }

  if (!response.body) {
    throw createError({
      statusCode: 500,
      message: "No response body from host-manager",
    })
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      target.write(decoder.decode(value, { stream: true }))
    }
  } finally {
    reader.releaseLock()
  }
}
