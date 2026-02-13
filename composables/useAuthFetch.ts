/**
 * Composable for authenticated API calls
 * Automatically adds JWT token, handles 401 errors, and provides convenient wrappers
 */

interface SSEData {
  type: string
  message: string
  success?: boolean
}

export function useAuthFetch() {
  const router = useRouter()

  function getAuthHeaders() {
    const token = process.client ? localStorage.getItem("swarm-config-token") : null
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  function handleUnauthorized() {
    if (process.client) {
      localStorage.removeItem("swarm-config-token")
    }
    router.push("/login")
  }

  /**
   * Make an authenticated API request with automatic 401 handling
   * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param url - Request URL
   * @param body - Optional request body (will be JSON stringified)
   * @param options - Additional fetch options
   */
  async function authFetch<T = unknown>(
    method: RequestInit["method"],
    url: string,
    body?: unknown,
    options: Record<string, unknown> = {},
  ) {
    try {
      const authHeaders = getAuthHeaders()
      const optionsHeaders = (options.headers as Record<string, string>) || {}
      const headers: Record<string, string> = { ...authHeaders, ...optionsHeaders }

      const fetchOptions: Record<string, unknown> = {
        ...options,
        method,
        headers,
      }

      if (body !== undefined) {
        fetchOptions.body = body
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json"
        }
      }

      return await $fetch<T>(url, fetchOptions)
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error) {
        const err = error as { statusCode: number }
        if (err.statusCode === 401) {
          handleUnauthorized()
        }
      }
      throw error
    }
  }

  /**
   * Make an authenticated streaming request (for SSE endpoints)
   * Automatically handles SSE parsing and calls onMessage for each event
   * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param url - Request URL
   * @param body - Optional request body (will be JSON stringified)
   * @param onMessage - Callback function that receives parsed SSE data
   * @param options - Additional fetch options
   */
  async function authFetchStream(
    method: RequestInit["method"],
    url: string,
    body?: unknown,
    onMessage?: (data: SSEData) => void,
    options: RequestInit = {},
  ) {
    const token = process.client ? localStorage.getItem("swarm-config-token") : null
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    if (body !== undefined) {
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json"
      }
    }

    const response = await fetch(url, {
      ...options,
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401) {
      handleUnauthorized()
      throw new Error("Session expired")
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error("No response body")
    }

    // Stream and decode SSE messages
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    function processLine(line: string) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6)) as SSEData
          if (onMessage) {
            onMessage(data)
          }
        } catch (parseError) {
          console.error("Failed to parse SSE line:", line, parseError)
        }
      }
    }

    async function readStream() {
      try {
        const { done, value } = await reader.read()
        if (done) return

        const chunk = decoder.decode(value)
        chunk.split("\n").forEach(processLine)

        return readStream()
      } catch (error) {
        console.error("Stream read error:", error)
        throw error
      }
    }

    try {
      await readStream()
    } catch (error) {
      console.error("Stream processing error:", error)
      throw error
    }
  }

  return {
    authFetch,
    authFetchStream,
    getAuthHeaders,
  }
}
