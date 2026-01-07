import { readFileSync, existsSync } from "node:fs"

const HOST_MANAGER_URL = "http://host-manager:3001"

/**
 * Get the host-manager authentication token
 * Tries to read from Docker secret first, then falls back to environment variable
 */
function getHostManagerToken(): string | undefined {
  const secretPath = "/run/secrets/host_manager_token"

  // Try Docker secret first (production/swarm mode)
  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim()
    } catch (error) {
      console.error("Failed to read host_manager_token secret:", error)
    }
  }

  // Fall back to environment variable (development/compose mode)
  return process.env.HOST_MANAGER_TOKEN
}

/**
 * Make an authenticated request to the host-manager service
 */
export async function hostManagerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getHostManagerToken()

  if (!token) {
    throw createError({
      statusCode: 500,
      message: "Host manager token not configured",
    })
  }

  const url = `${HOST_MANAGER_URL}${path}`
  const headers = new Headers(options.headers || {})
  headers.set("Authorization", `Bearer ${token}`)

  const response = await fetch(url, {
    ...options,
    headers,
  })

  return response
}

/**
 * Make an authenticated request to the host-manager and parse JSON response
 */
export async function hostManagerRequest<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await hostManagerFetch(path, options)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw createError({
      statusCode: response.status,
      message: error.error || `Host manager request failed: ${response.statusText}`,
    })
  }

  return await response.json()
}
