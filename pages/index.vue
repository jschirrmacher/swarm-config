<script setup lang="ts">
import type { Repository, CreateRepoRequest } from '~/types'

definePageMeta({
  layout: 'default'
})

const loading = ref(true)
const creating = ref(false)
const repositories = ref<Repository[]>([])
const error = ref('')
const successMessage = ref('')
const copySuccess = ref('')
const router = useRouter()

const newRepo = ref<CreateRepoRequest>({
  name: '',
  port: 3000
})

// Inject auth utilities from layout
const getAuthHeaders = inject<() => HeadersInit>('getAuthHeaders', () => ({}))
const logout = inject<() => void>('logout', () => { })

async function loadRepositories() {
  loading.value = true
  error.value = ''

  try {
    const data = await $fetch<Repository[]>('/api/services', { headers: getAuthHeaders() })
    repositories.value = data
  } catch (err: any) {
    if (err?.statusCode === 401) {
      logout?.()
      return
    }
    error.value = 'Failed to load repositories'
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function createRepository() {
  if (!newRepo.value.name) return

  creating.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch('/api/services', {
      method: 'POST',
      body: newRepo.value,
      headers: getAuthHeaders()
    })

    if (response.success && response.repository) {
      successMessage.value = `Project "${response.repository.name}" created successfully!`
      newRepo.value = { name: '', port: 3000 }
      await loadRepositories()

      // Clear success message after 5 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)
    } else {
      error.value = response.error || 'Failed to create project'
    }
  } catch (err: any) {
    if (err?.statusCode === 401) {
      logout?.()
      return
    }
    error.value = 'Failed to create project'
    console.error(err)
  } finally {
    creating.value = false
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

async function copyGitUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    copySuccess.value = 'Git URL copied to clipboard!'
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

onMounted(() => {
  loadRepositories()
})
</script>

<template>
  <div class="container">
    <section class="hero">
      <h2>Your Projects</h2>
      <p>Create and manage projects with Git repositories for automated deployment. Click on a project to view and
        edit its
        configuration.</p>
    </section>

    <section class="repos-section">
      <AppLoading v-if="loading" text="Loading projects..." />

      <div v-else-if="repositories.length === 0" class="empty-state">
        <p>No projects yet. Create your first one below!</p>
      </div>

      <div v-else class="repos-grid">
        <div v-for="repo in repositories" :key="repo.name" class="repo-card">
          <div class="repo-content">
            <div class="repo-header">
              <h3 class="repo-title">
                <NuxtLink :to="`/services/${repo.name}`" class="config-link">
                  {{ repo.name }}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="config-icon">
                    <path
                      d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z" />
                    <path
                      d="M6.854 4.646a.5.5 0 0 1 0 .708L4.207 8l2.647 2.646a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0zm2.292 0a.5.5 0 0 0 0 .708L11.793 8l-2.647 2.646a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0z" />
                  </svg>
                </NuxtLink>
              </h3>
              <div class="repo-actions">
                <span v-if="repo.hasStack && repo.dockerStack" class="docker-status">
                  <span v-if="repo.dockerStack.exists"
                    :class="['status-badge', repo.dockerStack.running === repo.dockerStack.total ? 'status-running' : 'status-partial']"
                    :title="`${repo.dockerStack.running}/${repo.dockerStack.total} containers running`">
                    {{ repo.dockerStack.running === repo.dockerStack.total ? '●' : '◐' }}
                    {{ repo.dockerStack.running }}/{{ repo.dockerStack.total }}
                  </span>
                  <span v-else class="status-badge status-stopped" title="No containers running">
                    ○ stopped
                  </span>
                </span>
                <a v-if="repo.kongRoute" :href="repo.kongRoute" target="_blank" rel="noopener" class="external-link"
                  title="Open app">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path
                      d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
                    <path
                      d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
                  </svg>
                </a>
              </div>
            </div>
            <div class="url-with-copy">
              <code>{{ repo.gitUrl }}</code>
              <button @click="copyGitUrl(repo.gitUrl)" class="btn-icon" title="Copy Git URL">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Z" />
                  <path d="M2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V5H2Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AppAlert type="success" :message="copySuccess" />
    </section>

    <section class="create-section">
      <h3>Create New Project</h3>
      <form @submit.prevent="createRepository" class="create-form">
        <div class="service-basics">
          <div class="form-group">
            <label for="repoName">Project Name</label>
            <input id="repoName" v-model="newRepo.name" type="text" placeholder="my-awesome-app" pattern="[a-z0-9-]+"
              required :disabled="creating" class="form-input" />
            <small>Only lowercase letters, numbers, and hyphens</small>
          </div>

          <div class="form-group">
            <label for="repoPort">Port</label>
            <input id="repoPort" v-model.number="newRepo.port" type="number" min="1000" max="65535" placeholder="3000"
              :disabled="creating" class="form-input" />
            <small>Port your application listens on</small>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="creating">
          {{ creating ? 'Creating...' : '+ Create Project' }}
        </button>
      </form>

      <AppAlert type="error" :message="error" />
      <AppAlert type="success" :message="successMessage" />
    </section>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.hero p {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.services-section {
  margin-top: 2rem;
  margin-bottom: 3rem;
}

.services-section h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.5rem;
}

.service-card {
  background: var(--bg-secondary);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  box-shadow: 0 1px 3px var(--shadow);
  transition: all 0.2s;
}

.service-card:hover {
  box-shadow: 0 2px 6px var(--shadow);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.service-name {
  color: var(--accent);
  font-size: 1rem;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.service-name:hover {
  color: var(--accent-hover);
}

.service-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.status-running {
  background: rgba(0, 255, 0, 0.15);
  color: #22aa22;
}

.dark .status-running {
  background: rgba(0, 255, 0, 0.2);
  color: #44cc44;
}

.status-partial {
  background: rgba(255, 193, 7, 0.15);
  color: #856404;
}

.dark .status-partial {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-stopped {
  background: rgba(255, 0, 0, 0.15);
  color: #c33;
}

.dark .status-stopped {
  background: rgba(255, 0, 0, 0.2);
  color: #ff6666;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.service-header h4 {
  color: var(--accent);
  font-size: 1rem;
  margin: 0;
  font-weight: 600;
}

.service-badge {
  background: var(--border-color);
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.service-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.service-file {
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-family: monospace;
}

.service-example-badge {
  font-size: 1rem;
}

.create-section {
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow);
  margin-top: 3rem;
  transition: background-color 0.3s ease;
}

.create-section h3 {
  margin-bottom: 1.5rem;
  color: var(--text-primary);
  text-align: center;
}

.create-form {
  max-width: 600px;
  margin: 0 auto;
}

.service-basics {
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.875rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.form-group input[type="text"],
.form-group input[type="number"] {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group input:disabled {
  background: var(--border-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.form-group.checkbox label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.form-group.checkbox input {
  width: auto;
  margin-right: 0.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: var(--border-color);
  color: var(--text-primary);
}

.btn-small:hover {
  background: var(--shadow);
}

.repos-section {
  margin-top: 2rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 8px;
  transition: background-color 0.3s ease;
}

.repos-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.repo-card {
  background: var(--bg-secondary);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  box-shadow: 0 1px 3px var(--shadow);
  transition: all 0.3s;
}

.repo-card:hover {
  box-shadow: 0 2px 6px var(--shadow);
}


.repo-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.docker-status {
  display: flex;
  align-items: center;
}

.repo-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.repo-title {
  color: var(--accent);
  font-size: 1rem;
  margin: 0;
  flex: 1;
}

.config-link {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.config-link:hover {
  color: var(--accent-hover);
}

.config-icon {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.config-link:hover .config-icon {
  opacity: 1;
}

.external-link {
  color: var(--accent);
  display: flex;
  align-items: center;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.external-link:hover {
  background: var(--border-color);
  color: var(--accent-hover);
}

.repo-date {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.repo-details {
  margin-bottom: 1rem;
}

.detail {
  margin-bottom: 0.75rem;
}

.detail strong {
  display: block;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.detail code {
  background: var(--bg-primary);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.875rem;
  word-break: break-all;
  display: block;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.detail a {
  color: var(--accent);
  text-decoration: none;
}

.detail a:hover {
  text-decoration: underline;
}

.url-with-copy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.url-with-copy code {
  flex: 1;
}

.btn-icon {
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

.btn-icon:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-icon:active {
  transform: scale(0.95);
}

.footer {
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 2rem 0;
  text-align: center;
  margin-top: 4rem;
  border-top: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.footer p {
  opacity: 0.8;
}
</style>
