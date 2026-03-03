<script setup lang="ts">
import type { Repository } from '~/types'

const props = defineProps<{
  project: Repository
}>()

const copySuccess = ref(false)
const actionLoading = ref(false)

const { authFetch } = useAuthFetch()

async function copyGitUrl() {
  try {
    await navigator.clipboard.writeText(props.project.gitUrl!)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

async function toggleService() {
  if (actionLoading.value) return

  actionLoading.value = true
  try {
    const isStopped = !props.project.dockerStack?.exists || props.project.dockerStack.running === 0
    const endpoint = isStopped ? 'start' : 'stop'

    await authFetch('POST', `/api/services/${props.project.name}/${endpoint}`)

    // Reload page to update status
    window.location.reload()
  } catch (err) {
    console.error('Failed to toggle service:', err)
  } finally {
    actionLoading.value = false
  }
}

</script>

<template>
  <NuxtLink :to="`/services/${project.name}`" class="project-card">
    <div class="project-content">
      <div class="project-header">
        <h3 class="project-title">
          {{ project.name }}
        </h3>
        <div class="project-actions" @click.prevent>
          <button v-if="project.hasStack && project.dockerStack" @click="toggleService" class="docker-status-btn"
            :disabled="actionLoading">
            <span v-if="project.dockerStack.exists"
              :class="['status-badge', project.dockerStack.running === project.dockerStack.total ? 'status-running' : 'status-partial']"
              :title="`${project.dockerStack.running}/${project.dockerStack.total} containers running - click to stop`">
              {{ project.dockerStack.running === project.dockerStack.total ? '●' : '◐' }}
              {{ project.dockerStack.running }}/{{ project.dockerStack.total }}
            </span>
            <span v-else class="status-badge status-stopped" title="No containers running - click to start">
              ○ stopped
            </span>
          </button>
          <a v-if="project.kongRoute" :href="project.kongRoute" target="_blank" rel="noopener" class="external-link"
            title="Open app" @click.stop>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
              <path
                d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
            </svg>
          </a>
        </div>
      </div>
      <div class="project-meta" @click.prevent>
        <div class="git-info">
          <button v-if="project.gitRepoExists" @click="copyGitUrl" class="btn-git-copy"
            :title="copySuccess ? 'Copied!' : 'Copy Git URL'">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fill="#F05032"
                d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0L5.632 1.925l1.221 1.221a1.225 1.225 0 0 1 1.55 1.56l1.177 1.177a1.225 1.225 0 1 1-.732.732L7.672 5.438v3.097a1.225 1.225 0 1 1-.98.144V5.317a1.225 1.225 0 0 1-.665-1.605L4.81 2.495.302 6.99a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.03 1.03 0 0 0 0-1.457" />
            </svg>
            <svg v-if="!copySuccess" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Z" />
              <path d="M2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V5H2Z" />
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
            </svg>
          </button>
          <span v-else class="git-missing">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
              <path
                d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
            </svg>
            No Git repo
          </span>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.project-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px var(--shadow);
  transition: all 0.3s;
  height: 100%;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.project-card:hover {
  box-shadow: 0 4px 12px var(--shadow);
  transform: translateY(-2px);
}

.project-card:hover .repo-title {
  color: var(--accent-hover);
}

.project-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.project-title {
  color: var(--accent);
  font-size: 1rem;
  margin: 0;
  flex: 1;
  transition: color 0.2s;
}

.project-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.project-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.git-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-git-copy {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: all 0.2s;
}

.btn-git-copy:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-git-copy:active {
  transform: scale(0.95);
}

.git-missing {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #f59e0b;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.1);
}

.docker-status {
  display: flex;
  align-items: center;
}

.docker-status-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: opacity 0.2s;
}

.docker-status-btn:hover {
  opacity: 0.8;
}

.docker-status-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.repo-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent);
  padding: 0.25rem;
}

.repo-status.repo-missing {
  color: #f59e0b;
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

.url-with-copy {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.url-with-copy code {
  flex: 1;
  background: var(--bg-primary);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.875rem;
  word-break: break-all;
  display: block;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
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
</style>
