<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const route = useRoute()
const router = useRouter()
const serviceName = computed(() => route.params.name as string)

const service = ref<any>(null)
const loading = ref(false)
const error = ref('')
const currentUser = ref<string | null>(null)
const saving = ref(false)
const saveSuccess = ref(false)
const domain = ref('')

// Computed: is this a structured service or raw text?
const isStructured = computed(() => service.value?.isStructured === true)

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

    const data = await response.json()
    service.value = data
    domain.value = data.domain || ''
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

async function saveService() {
  if (!service.value) return

  try {
    saving.value = true
    error.value = ''
    saveSuccess.value = false

    // Get auth headers (skip in dev mode)
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    if (!import.meta.dev && typeof window !== 'undefined') {
      const token = localStorage.getItem('swarm-config-token')
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    // Prepare payload based on whether it's structured or raw
    const payload = isStructured.value
      ? { parsed: service.value.parsed }
      : { content: service.value.content }

    const response = await fetch(`/api/services/${serviceName.value}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Failed to save service: ${response.statusText}`)
    }

    // Reload to get updated content
    await loadService()

    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to save service configuration'
    console.error('Error saving service:', err)
  } finally {
    saving.value = false
  }
}

function addRoute(serviceIndex: string | number) {
  const idx = typeof serviceIndex === 'number' ? serviceIndex : parseInt(serviceIndex, 10)
  if (!service.value?.parsed?.services?.[idx]) return

  const svc = service.value.parsed.services[idx]
  const hostname = domain.value ? `${svc.name}.${domain.value}` : ''

  // Generate route name following the pattern: stackName_serviceName or stackName_serviceName_N
  const stackName = serviceName.value
  const existingRouteCount = svc.routes.length
  const routeName = existingRouteCount > 0
    ? `${stackName}_${svc.name}_${existingRouteCount}`
    : `${stackName}_${svc.name}`

  service.value.parsed.services[idx].routes.push({
    host: hostname,
    options: {
      name: routeName
    }
  })
}

function removeRoute(serviceIndex: string | number, routeIndex: string | number) {
  const idx = typeof serviceIndex === 'number' ? serviceIndex : parseInt(serviceIndex, 10)
  const ridx = typeof routeIndex === 'number' ? routeIndex : parseInt(routeIndex, 10)
  if (!service.value?.parsed?.services?.[idx]) return

  service.value.parsed.services[idx].routes.splice(ridx, 1)
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

            </div>
          </div>

          <div class="code-section">
            <!-- Raw text editor for special cases -->
            <textarea v-if="!isStructured" v-model="service.content" class="code-editor" spellcheck="false"></textarea>

            <!-- Structured form for standard services -->
            <div v-else class="structured-form">
              <div v-for="(svc, svcIndex) in service.parsed.services" :key="svcIndex" class="service-block">
                <h4>Service</h4>

                <div class="service-basics">
                  <div class="form-group">
                    <label>Service Name</label>
                    <input v-model="svc.name" type="text" class="form-input" />
                  </div>

                  <div class="form-group">
                    <label>Port</label>
                    <input v-model.number="svc.port" type="number" class="form-input" />
                  </div>
                </div>

                <div class="routes-section">
                  <h5>Routes</h5>
                  <table class="routes-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Host</th>
                        <th>Path</th>
                        <th>Options</th>
                        <th>Plugins</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(route, routeIndex) in svc.routes" :key="routeIndex">
                        <td>
                          <input v-model="route.options.name" type="text" class="table-input" required />
                        </td>
                        <td>
                          <input v-model="route.host" type="text" class="table-input" />
                        </td>
                        <td>
                          <input v-model="route.options.paths" type="text" class="table-input" placeholder="/" />
                        </td>
                        <td class="options-cell">
                          <label class="checkbox-label">
                            <input v-model="route.options.strip_path" type="checkbox" />
                            Strip path
                          </label>
                          <label class="checkbox-label">
                            <input v-model="route.options.preserve_host" type="checkbox" />
                            Preserve host
                          </label>
                        </td>
                        <td>
                          <div class="plugins-display" v-if="route.plugins && route.plugins.length > 0">
                            <span v-for="(plugin, pIdx) in route.plugins" :key="pIdx" class="plugin-badge">
                              {{ plugin.name }}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button @click="removeRoute(svcIndex, routeIndex)" class="btn-icon" title="Remove route">
                            ✕
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <button @click="addRoute(svcIndex)" class="btn-add">+ Add Route</button>
                </div>
              </div>
            </div>

            <div class="actions-footer">
              <button @click="saveService" :disabled="saving" class="btn-save">
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
              <span v-if="saveSuccess" class="save-success">✓ Saved successfully</span>
            </div>
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

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.code-section h3 {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
}

.actions-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
}

.btn-save {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: #5568d3;
}

.btn-save:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.save-success {
  color: #4caf50;
  font-size: 0.9rem;
  font-weight: 500;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.code-editor {
  width: 100%;
  min-height: 500px;
  background: #f8f9fa;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  padding: 1.5rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #24292e;
  resize: vertical;
  overflow: auto;
}

/* Structured form styles */
.structured-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.service-block {
  border: 2px solid #e1e4e8;
  border-radius: 8px;
  padding: 1.5rem;
  background: #fafbfc;
}

.service-block h4 {
  margin: 0 0 1rem;
  color: #667eea;
  font-size: 1.1rem;
}

.service-block h5 {
  margin: 1.5rem 0 1rem;
  color: #333;
  font-size: 1rem;
}

.service-basics {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #333;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
  font-size: 0.8rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.routes-section {
  margin-top: 1.5rem;
}

.routes-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.routes-table thead {
  background: #f8f9fa;
}

.routes-table th {
  text-align: left;
  padding: 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e1e4e8;
}

.routes-table td {
  padding: 0.5rem;
  border-bottom: 1px solid #e1e4e8;
  vertical-align: middle;
}

.routes-table tbody tr:last-child td {
  border-bottom: none;
}

.table-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: inherit;
}

.table-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.options-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.plugins-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.plugin-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.btn-add {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add:hover {
  background: #5568d3;
}

.btn-icon {
  background: #dc3545;
  color: white;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn-icon:hover {
  background: #c82333;
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

  .code-editor {
    padding: 1rem;
    font-size: 0.85rem;
  }
}
</style>
