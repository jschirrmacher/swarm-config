import { readFileSync, existsSync } from "node:fs"

const HOST_MANAGER_URL = "http://host-manager:3001"

interface SmtpConfig {
  host: string
  port: string
  user: string
  from: string
  tls: boolean
}

interface SmtpReadResult {
  config?: SmtpConfig
}

interface SmtpWriteResult {
  success: boolean
  message?: string
  error?: string
}

function getHostManagerToken(): string {
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

async function makeRequest(
  method: RequestInit["method"],
  path: string,
  body?: unknown,
  options: RequestInit = {},
) {
  const token = getHostManagerToken()

  const response = await fetch(`${HOST_MANAGER_URL}${path}`, {
    ...options,
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...createHeaders(token),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: error.error || `Host manager request failed: ${response.statusText}`,
    })
  }

  return response
}

export async function systemUpdate(target: NodeJS.WritableStream) {
  const response = await makeRequest("POST", "/system/update", {})

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

export async function smtpRead() {
  const response = await makeRequest("GET", "/smtp")
  return response.json()
}

export async function smtpWrite(data: SmtpConfig & { password: string }) {
  const response = await makeRequest("POST", "/smtp", data)

  return (await response.json()).config
}
