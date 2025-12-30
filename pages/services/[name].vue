<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const route = useRoute()
const router = useRouter()
const serviceName = computed(() => route.params.name as string)

const service = ref<any>(null)
const loading = ref(false)
const error = ref('')
const currentUser = ref<string | null>(null)

function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('swarm-config-token')
  }
  router.push('/login')
}

onMounted(async () => {
  await loadService()
  await loadUser()
})

async function loadService() {
  try {
    loading.value = true
    error.value = ''

    // Get auth headers (skip in dev mode)
    const headers: HeadersInit = {}
    if (!import.meta.dev && typeof window !== 'undefined') {
      const token = localStorage.getItem('swarm-config-token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch(`/api/services/${serviceName.value}`, { headers })

    if (!response.ok) {
      throw new Error(`Failed to load service: ${response.statusText}`)
    }

    service.value = await response.json()
  } catch (err: any) {
    error.value = err.message || 'Failed to load service configuration'
    console.error('Error loading service:', err)
  } finally {
    loading.value = false
  }
}

async function loadUser() {
  try {
    // Get auth headers (skip in dev mode)
    const headers: HeadersInit = {}
    if (!import.meta.dev && typeof window !== 'undefined') {
      const token = localStorage.getItem('swarm-config-token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch('/api/user', { headers })

    if (response.ok) {
      const data = await response.json()
      currentUser.value = data.username
    }
  } catch (err) {
    console.error('Error loading user:', err)
  }
}
</script>

<template>
  <div class="layout">
    <AppHeader subtitle="Service Configuration" :current-user="currentUser" :show-logout="true" @logout="logout" />

    <main class="main">
      <div class="container">
        <nav class="breadcrumb">
          <NuxtLink to="/">← Back to Repositories</NuxtLink>
        </nav>

        <AppLoading v-if="loading" text="Loading service configuration..." />

        <AppAlert v-else-if="error" type="error" :message="error" />

        <section v-else-if="service" class="service-detail">
          <div class="service-header">
            <h2>{{ service.name }}</h2>
            <div class="service-meta">
              <span class="badge">{{ service.linesOfCode }} lines</span>
              <span v-if="service.hasExample" class="badge badge-info">Has example</span>
            </div>
          </div>

          <div class="code-section">
            <h3>Configuration</h3>
            <pre><code>{{ service.content }}</code></pre>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.main {
  padding: 3rem 0;
}

.breadcrumb {
  margin-bottom: 2rem;
}

.breadcrumb a {
  color: white;
  text-decoration: none;
  font-size: 0.95rem;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.breadcrumb a:hover {
  opacity: 1;
  text-decoration: underline;
}

.service-detail {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.service-header h2 {
  margin: 0;
  color: #333;
  font-size: 2rem;
}

.service-meta {
  display: flex;
  gap: 0.5rem;
}

.badge {
  background: #f0f0f0;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  color: #666;
}

.badge-info {
  background: #e3f2fd;
  color: #1976d2;
}

.code-section {
  margin-top: 2rem;
}

.code-section h3 {
  margin: 0 0 1rem;
  color: #333;
  font-size: 1.2rem;
}

pre {
  background: #f8f9fa;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  padding: 1.5rem;
  overflow-x: auto;
  margin: 0;
}

code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #24292e;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .service-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  pre {
    padding: 1rem;
    font-size: 0.85rem;
  }
}
</style>
