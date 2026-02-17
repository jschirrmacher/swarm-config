<script setup lang="ts">
import type { Repository } from '~/types'

const props = defineProps<{
  repository: Repository
}>()

const copySuccess = ref(false)

async function copyGitUrl() {
  try {
    await navigator.clipboard.writeText(props.repository.gitUrl)
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
          <span v-if="repository.gitRepoExists" class="repo-status" title="Git repository exists">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
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
