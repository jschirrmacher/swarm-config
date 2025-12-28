<template>
  <div class="layout">
    <header class="header">
      <div class="container">
        <div class="header-content">
          <div>
            <h1>🐳 Swarm Config</h1>
            <p class="subtitle">Repository Management</p>
          </div>
          <div v-if="currentUser" class="user-info">
            <span class="user-label">Logged in as:</span>
            <span class="user-name">{{ currentUser }}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="container">
        <section class="hero">
          <h2>Your Repositories</h2>
          <p>Create and manage Git repositories for automated deployment</p>
        </section>

        <section class="repos-section">
          <div v-if="loading" class="loading">
            Loading repositories...
          </div>

          <div v-else-if="repositories.length === 0" class="empty-state">
            <p>No repositories yet. Create your first one below!</p>
          </div>

          <div v-else class="repos-grid">
            <div v-for="repo in repositories" :key="repo.name" class="repo-card">
              <div class="repo-header">
                <h3>{{ repo.name }}</h3>
                <span class="repo-date">{{ formatDate(repo.createdAt) }}</span>
              </div>

              <div class="repo-details">
                <div class="detail">
                  <strong>Git URL:</strong>
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

                <div v-if="repo.kongRoute" class="detail">
                  <strong>HTTPS URL:</strong>
                  <a :href="repo.kongRoute" target="_blank" rel="noopener">
                    {{ repo.kongRoute }}
                  </a>
                </div>

                <div class="detail">
                  <strong>Workspace:</strong>
                  <code>{{ repo.workspaceDir }}</code>
                </div>
              </div>
            </div>
          </div>

          <div v-if="copySuccess" class="alert alert-success copy-alert">
            {{ copySuccess }}
          </div>
        </section>

        <section class="create-section">
          <h3>Create New Repository</h3>
          <form @submit.prevent="createRepository" class="create-form">
            <div class="form-group">
              <label for="repoName">Repository Name</label>
              <input id="repoName" v-model="newRepo.name" type="text" placeholder="my-awesome-app" pattern="[a-z0-9-]+"
                required :disabled="creating" />
              <small>Only lowercase letters, numbers, and hyphens</small>
            </div>

            <div class="form-group">
              <label for="repoPort">Port</label>
              <input id="repoPort" v-model.number="newRepo.port" type="number" min="1000" max="65535" placeholder="3000"
                :disabled="creating" />
              <small>Port your application listens on (Kong Gateway route will be created automatically)</small>
            </div>

            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? 'Creating...' : '+ Create Repository' }}
            </button>
          </form>

          <div v-if="error" class="alert alert-error">
            {{ error }}
          </div>

          <div v-if="successMessage" class="alert alert-success">
            {{ successMessage }}
          </div>
        </section>
      </div>
    </main>

    <footer class="footer">
      <div class="container">
        <p>Swarm Config - Docker Swarm CI/CD Platform</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import type { Repository, CreateRepoRequest } from '~/types'

const loading = ref(true)
const creating = ref(false)
const repositories = ref<Repository[]>([])
const error = ref('')
const successMessage = ref('')
const copySuccess = ref('')
const currentUser = ref('')

const newRepo = ref<CreateRepoRequest>({
  name: '',
  port: 3000
})

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/user')
    if (response.ok) {
      const data = await response.json()
      currentUser.value = data.username
    }
  } catch (err) {
    console.error('Failed to load current user:', err)
  }
}

async function loadRepositories() {
  loading.value = true
  error.value = ''

  try {
    const data = await $fetch<Repository[]>('/api/repositories')
    repositories.value = data
  } catch (err) {
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
    const response = await $fetch('/api/repositories/create', {
      method: 'POST',
      body: newRepo.value
    })

    if (response.success && response.repository) {
      successMessage.value = `Repository "${response.repository.name}" created successfully!`
      newRepo.value = { name: '', port: 3000 }
      await loadRepositories()

      // Clear success message after 5 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)
    } else {
      error.value = response.error || 'Failed to create repository'
    }
  } catch (err) {
    error.value = 'Failed to create repository'
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
  loadCurrentUser()
  loadRepositories()
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.user-label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.user-name {
  font-size: 1.1rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  opacity: 0.9;
  font-size: 1.1rem;
}

.main {
  padding: 2rem 0;
  min-height: calc(100vh - 200px);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.hero p {
  color: #666;
  font-size: 1.1rem;
}

.create-section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 3rem;
}

.create-section h3 {
  margin-bottom: 1.5rem;
  color: #333;
  text-align: center;
}

.create-form {
  max-width: 600px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
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
  background: #f5f5f5;
  color: #333;
}

.btn-small:hover {
  background: #e0e0e0;
}

.alert {
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.alert-error {
  background: #fee;
  color: #c00;
  border: 1px solid #fcc;
}

.alert-success {
  background: #efe;
  color: #060;
  border: 1px solid #cfc;
}

.copy-alert {
  max-width: 400px;
  margin: 1rem auto;
  text-align: center;
}

.repos-section {
  margin-top: 2rem;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
  background: white;
  border-radius: 8px;
}

.repos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.repo-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.repo-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.repo-header h3 {
  color: #667eea;
  font-size: 1.25rem;
}

.repo-date {
  font-size: 0.75rem;
  color: #999;
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
  color: #666;
  margin-bottom: 0.25rem;
}

.detail code {
  background: #f5f5f5;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.875rem;
  word-break: break-all;
  display: block;
}

.detail a {
  color: #667eea;
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
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
  color: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-icon:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.btn-icon:active {
  transform: scale(0.95);
}

.footer {
  background: #333;
  color: white;
  padding: 2rem 0;
  text-align: center;
  margin-top: 4rem;
}

.footer p {
  opacity: 0.8;
}
</style>
