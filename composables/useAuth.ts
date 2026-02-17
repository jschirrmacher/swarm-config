export function useAuth() {
  const user = useState<{ username: string } | null>('auth-user', () => null)
  const loading = useState('auth-loading', () => false)

  async function fetchUser() {
    if (loading.value) return
    
    try {
      loading.value = true
      const { authFetch } = useAuthFetch()
      const data = await authFetch<{ username: string }>('GET', '/api/user')
      user.value = data
    } catch (error) {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  function logout() {
    if (process.client) {
      localStorage.removeItem('swarm-config-token')
    }
    user.value = null
    navigateTo('/login')
  }

  return {
    user: readonly(user),
    loading: readonly(loading),
    fetchUser,
    logout
  }
}
