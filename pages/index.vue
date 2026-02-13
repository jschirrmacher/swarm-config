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

const { authFetch } = useAuthFetch()

async function loadRepositories() {
  loading.value = true
  error.value = ''

  try {
    repositories.value = await authFetch<Repository[]>('GET', '/api/services')
  } catch (err: any) {
    error.value = 'Failed to load repositories'
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function createRepository(data: CreateRepoRequest) {
  creating.value = true
  error.value = ''
  successMessage.value = ''

  try {
    interface CreateServiceResponse {
      success: boolean
      repository?: {
        name: string
      }
      error?: string
    }

    const response = await authFetch<CreateServiceResponse>('POST', '/api/services', data)

    if (response.success && response.repository) {
      successMessage.value = `Project "${response.repository.name}" created successfully!`
      await loadRepositories()

      // Clear success message after 5 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)
    } else {
      error.value = response.error || 'Failed to create project'
    }
  } catch (err: any) {
    error.value = 'Failed to create project'
    console.error(err)
  } finally {
    creating.value = false
  }
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
        edit its configuration.</p>
    </section>

    <section class="repos-section">
      <AppLoading v-if="loading" text="Loading projects..." />

      <EmptyRepositories v-else-if="repositories.length === 0" />

      <div v-else class="repos-grid">
        <RepositoryCard v-for="repo in repositories" :key="repo.name" :repository="repo" @copy-url="copyGitUrl" />
      </div>

      <AppAlert type="success" :message="copySuccess" />
    </section>

    <CreateRepositoryForm :creating="creating" @submit="createRepository" />

    <AppAlert type="error" :message="error" />
    <AppAlert type="success" :message="successMessage" />
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

.repos-section {
  margin-top: 2rem;
}

.repos-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
