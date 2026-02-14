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

  return {
    authFetch,
    getAuthHeaders,
  }
}
