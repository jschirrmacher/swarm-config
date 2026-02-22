<script setup lang="ts">
import type { Repository } from '~/types'

const props = defineProps<{
  repository: Repository
}>()

const copySuccess = ref(false)

async function copyGitUrl() {
  try {
    await navigator.clipboard.writeText(props.repository.gitUrl!)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

</script>

<template>
  <div class="repo-card">
    <div class="repo-content">
      <div class="repo-header">
        <h3 class="repo-title">
          <NuxtLink :to="`/services/${repository.name}`" class="config-link">
            {{ repository.name }}
          </NuxtLink>
        </h3>
        <div class="repo-actions">
          <span v-if="repository.hasStack && repository.dockerStack" class="docker-status">
            <span v-if="repository.dockerStack.exists"
              :class="['status-badge', repository.dockerStack.running === repository.dockerStack.total ? 'status-running' : 'status-partial']"
              :title="`${repository.dockerStack.running}/${repository.dockerStack.total} containers running`">
              {{ repository.dockerStack.running === repository.dockerStack.total ? '●' : '◐' }}
              {{ repository.dockerStack.running }}/{{ repository.dockerStack.total }}
            </span>
            <span v-else class="status-badge status-stopped" title="No containers running">
              ○ stopped
            </span>
          </span>
          <a v-if="repository.kongRoute" :href="repository.kongRoute" target="_blank" rel="noopener"
            class="external-link" title="Open app">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
              <path
                d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
            </svg>
          </a>
          <span v-if="repository.hasWorkspace" class="repo-status" title="Workspace exists">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v3A1.5 1.5 0 0 0 2.5 7h3A1.5 1.5 0 0 0 7 5.5v-3A1.5 1.5 0 0 0 5.5 1h-3zm6.5 0v6h3A1.5 1.5 0 0 0 13.5 5.5v-3A1.5 1.5 0 0 0 12 1H9zM2.5 9A1.5 1.5 0 0 0 1 10.5v3A1.5 1.5 0 0 0 2.5 15h3A1.5 1.5 0 0 0 7 13.5v-3A1.5 1.5 0 0 0 5.5 9h-3zm6.5 0v6h3a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 12 9H9z"/>
            </svg>
          </span>
          <span v-else class="repo-status repo-missing" title="No workspace">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
            </svg>
          </span>
          <span v-if="repository.gitRepoExists" class="repo-status" title="Git repository exists">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path fill="#F05032" d="M15.698 7.287L8.712.302a1.03 1.03 0 0 0-1.457 0L5.632 1.925l1.221 1.221a1.225 1.225 0 0 1 1.55 1.56l1.177 1.177a1.225 1.225 0 1 1-.732.732L7.672 5.438v3.097a1.225 1.225 0 1 1-.98.144V5.317a1.225 1.225 0 0 1-.665-1.605L4.81 2.495.302 6.99a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.03 1.03 0 0 0 0-1.457"/>
            </svg>
          </span>
          <span v-else class="repo-status repo-missing" title="Git repository not found">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
            </svg>
          </span>
        </div>
      </div>
      <div class="repo-meta">
        <span class="repo-date" :title="`Created: ${new Date(repository.createdAt).toLocaleString()}`">
          {{ new Date(repository.createdAt).toLocaleDateString() }}
        </span>
        <button v-if="repository.gitRepoExists" @click="copyGitUrl" class="btn-copy-git" :title="copySuccess ? 'Copied!' : 'Copy Git URL'">
          <svg v-if="!copySuccess" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Z" />
            <path d="M2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V5H2Z" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.repo-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px var(--shadow);
  transition: all 0.3s;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.repo-card:hover {
  box-shadow: 0 4px 12px var(--shadow);
  transform: translateY(-2px);
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
  transition: all 0.2s;
}

.config-link:hover {
  color: var(--accent-hover);
}

.repo-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.repo-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.repo-date {
  opacity: 0.7;
}

.btn-copy-git {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.35rem;
  cursor: pointer;
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-copy-git:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn-copy-git:active {
  transform: scale(0.95);
}

.docker-status {
  display: flex;
  align-items: center;
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
