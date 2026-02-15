<script setup lang="ts">
import type { Repository } from '~/types'

const props = defineProps<{
  repository: Repository
}>()

const emit = defineEmits<{
  copyUrl: [url: string]
}>()

const creatingRepo = ref(false)

function handleCopy() {
  emit('copyUrl', props.repository.gitUrl)
}

async function createGitRepo() {
  creatingRepo.value = true
  try {
    await $fetch(`/api/services/${props.repository.name}/git-repo`, { method: 'POST' })
    window.location.reload()
  } catch (error) {
    console.error('Failed to create git repository:', error)
    alert('Failed to create git repository')
  } finally {
    creatingRepo.value = false
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="config-icon">
              <path
                d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z" />
              <path
                d="M6.854 4.646a.5.5 0 0 1 0 .708L4.207 8l2.647 2.646a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0zm2.292 0a.5.5 0 0 0 0 .708L11.793 8l-2.647 2.646a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0z" />
            </svg>
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
        </div>
      </div>
      <div class="url-with-copy">
        <code v-if="repository.gitRepoExists">{{ repository.gitUrl }}</code>
        <div v-else class="no-repo-warning">
          <span class="warning-icon">⚠</span>
          <span>Git repository not found</span>
        </div>
        <button v-if="repository.gitRepoExists" @click="handleCopy" class="btn-icon" title="Copy Git URL">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Z" />
            <path d="M2 5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V5H2Z" />
          </svg>
        </button>
        <button v-else @click="createGitRepo" :disabled="creatingRepo" class="btn-create" title="Create Git repository">
          {{ creatingRepo ? 'Creating...' : 'Create Repo' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.repo-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.docker-status {
  display: flex;
  align-items: center;
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

.no-repo-warning {
  flex: 1;
  background: rgba(255, 193, 7, 0.15);
  padding: 0.5rem;
  border-radius: 3px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #856404;
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.dark .no-repo-warning {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  border-color: rgba(255, 193, 7, 0.4);
}

.warning-icon {
  font-size: 1rem;
}

.btn-create {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-create:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-create:active:not(:disabled) {
  transform: scale(0.95);
}
</style>
