/**
 * Composable for authenticated API calls
 * Automatically adds JWT token from localStorage to requests
 */
export const useAuthFetch = () => {
  const makeRequest = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("swarm-config-token")

    if (!token) {
      throw new Error("Not authenticated")
    }

    const headers = new Headers(options.headers || {})
    headers.set("Authorization", `Bearer ${token}`)

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Handle 401 by redirecting to login
    if (response.status === 401) {
      localStorage.removeItem("swarm-config-token")
      navigateTo("/login")
      throw new Error("Session expired")
    }

    return response
  }

  return {
    authFetch: makeRequest,
  }
}
