<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const serviceName = computed(() => route.params.name as string)

const service = ref<any>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveSuccess = ref(false)
const copySuccess = ref(false)
const activeTab = ref<'status' | 'logs' | 'env'>('status')
const logs = ref('')
const envVars = ref<Record<string, string>>({})

const { authFetch } = useAuthFetch()
const { user } = useAuth()

const isOwner = computed(() => {
  if (!service.value || !user.value) return false
  return service.value.owner === user.value.username
})

onMounted(async () => {
  await loadService()
})

async function loadService() {
  try {
    loading.value = true
    error.value = ''

    const data = await authFetch('GET', `/api/services/${serviceName.value}`)
    service.value = data
    
    if (isOwner.value && data.env) {
      envVars.value = { ...data.env }
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load service'
    console.error('Error loading service:', err)
  } finally {
    loading.value = false
  }
}

async function copyGitUrl() {
  if (!service.value?.gitUrl) return
  
  try {
    await navigator.clipboard.writeText(service.value.gitUrl)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

async function loadLogs() {
  if (!service.value) return
  
  try {
    const data = await authFetch('GET', `/api/services/${serviceName.value}/logs`)
    logs.value = data.logs || 'No logs available'
  } catch (err: any) {
    logs.value = `Error loading logs: ${err.message}`
  }
}

async function saveEnv() {
  if (!isOwner.value) return

  try {
    saving.value = true
    error.value = ''
    saveSuccess.value = false

    await authFetch('PUT', `/api/services/${serviceName.value}/env`, { env: envVars.value })

    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to save environment variables'
  } finally {
    saving.value = false
  }
}

function addEnvVar() {
  const key = prompt('Environment variable name:')
  if (key && !envVars.value[key]) {
    envVars.value[key] = ''
  }
}

function removeEnvVar(key: string) {
  if (confirm(`Remove ${key}?`)) {
    delete envVars.value[key]
  }
}

watch(activeTab, (newTab) => {
  if (newTab === 'logs' && !logs.value) {
    loadLogs()
  }
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb">
      <NuxtLink to="/">← Back to Services</NuxtLink>
    </nav>

    <AppLoading v-if="loading" text="Loading service..." />

    <AppAlert v-else-if="error" type="error" :message="error" />

    <section v-else-if="service" class="service-detail">
      <div class="service-header">
        <h2>{{ service.name }}</h2>
        <span v-if="service.status" :class="['status-badge', service.status]">
          {{ service.status }}
        </span>
      </div>

      <div v-if="service.gitUrl" class="git-section">
        <label>Git Repository</label>
        <div class="git-url-box">
          <code>{{ service.gitUrl }}</code>
          <button @click="copyGitUrl" class="btn-copy" title="Copy Git URL">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Z" />
              <path d="M2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V5H2Z" />
            </svg>
          </button>
        </div>
        <span v-if="copySuccess" class="copy-success">✓ Copied!</span>
      </div>

      <div class="tabs">
        <button :class="{ active: activeTab === 'status' }" @click="activeTab = 'status'" class="tab-button">
          Status
        </button>
        <button :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'" class="tab-button">
          Logs
        </button>
        <button v-if="isOwner" :class="{ active: activeTab === 'env' }" @click="activeTab = 'env'" class="tab-button">
          Environment
        </button>
      </div>

      <div class="tab-content">
        <!-- Status Tab -->
        <div v-if="activeTab === 'status'" class="status-section">
          <div class="info-grid">
            <div class="info-item">
              <label>Owner</label>
              <span>{{ service.owner }}</span>
            </div>
            <div class="info-item">
              <label>Version</label>
              <span>{{ service.version || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Replicas</label>
              <span>{{ service.replicas || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <label>Created</label>
              <span>{{ service.createdAt ? new Date(service.createdAt).toLocaleString() : 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Logs Tab -->
        <div v-else-if="activeTab === 'logs'" class="logs-section">
          <pre class="logs-viewer">{{ logs || 'Loading logs...' }}</pre>
        </div>

        <!-- Environment Tab -->
        <div v-else-if="activeTab === 'env' && isOwner" class="env-section">
          <div class="env-header">
            <h3>Environment Variables</h3>
            <button @click="addEnvVar" class="btn-add">+ Add Variable</button>
          </div>
          
          <div v-if="Object.keys(envVars).length === 0" class="empty-state">
            No environment variables configured
          </div>
          
          <div v-else class="env-list">
            <div v-for="(value, key) in envVars" :key="key" class="env-item">
              <label>{{ key }}</label>
              <input v-model="envVars[key]" type="text" class="env-input" />
              <button @click="removeEnvVar(key)" class="btn-remove">×</button>
            </div>
          </div>

          <div class="actions-footer">
            <button @click="saveEnv" :disabled="saving" class="btn-save">
              {{ saving ? 'Saving...' : 'Save Environment' }}
            </button>
            <span v-if="saveSuccess" class="save-success">✓ Saved successfully</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
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
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 30px var(--shadow);
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
  color: var(--text-primary);
}

.git-section {
  margin-bottom: 1.5rem;
}

.git-section label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.git-section label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.git-url-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.75rem;
}

.git-url-box code {
  flex: 1;
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.btn-copy {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-copy:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.copy-success {
  display: block;
  margin-top: 0.5rem;
  color: #4caf50;
  font-size: 0.85rem;
  animation: fadeIn 0.3s;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.running {
  background: #4caf50;
  color: white;
}

.status-badge.stopped {
  background: #f44336;
  color: white;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-color);
}

.tab-button {
  background: transparent;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-button:hover {
  color: var(--accent);
}

.tab-button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.tab-content {
  margin-top: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.info-item span {
  color: var(--text-primary);
}

.logs-viewer {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-primary);
  max-height: 600px;
  overflow: auto;
  white-space: pre-wrap;
}

.env-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.env-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.btn-add {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add:hover {
  background: var(--accent-hover);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.env-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.env-item {
  display: grid;
  grid-template-columns: 200px 1fr auto;
  gap: 1rem;
  align-items: center;
}

.env-item label {
  font-weight: 600;
  color: var(--text-primary);
}

.env-input {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.env-input:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-remove {
  background: #f44336;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 1.5rem;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove:hover {
  background: #d32f2f;
}

.actions-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-save {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-save:disabled {
  background: var(--border-color);
  cursor: not-allowed;
  opacity: 0.6;
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

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .service-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .env-item {
    grid-template-columns: 1fr;
  }
}
</style>
