<script setup lang="ts">
const router = useRouter()
const currentUser = ref<string | null>(null)

// Get auth headers from localStorage
function getAuthHeaders(): HeadersInit {
  // In development mode, skip auth headers
  if (import.meta.dev) {
    return {}
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('swarm-config-token') : null
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// Logout function
function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('swarm-config-token')
  }
  router.push('/login')
}

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/user', {
      headers: getAuthHeaders()
    })
    if (response.ok) {
      const data = await response.json() as { username: string }
      currentUser.value = data.username
    } else if (response.status === 401 && !import.meta.dev) {
      // Unauthorized - redirect to login (except in dev mode)
      logout()
    }
  } catch (err) {
    console.error('Failed to load current user:', err)
  }
}

onMounted(() => {
  loadCurrentUser()
})

// Provide auth utilities to child components
provide('currentUser', currentUser)
provide('logout', logout)
provide('getAuthHeaders', getAuthHeaders)
</script>

<template>
  <div class="layout">
    <AppHeader :current-user="currentUser" :show-logout="true" :show-system-update="true" @logout="logout" />

    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.main {
  padding: 2rem 0;
  min-height: calc(100vh - 200px);
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
}
</style>
