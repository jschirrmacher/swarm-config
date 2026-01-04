<script setup lang="ts">
const updating = ref(false)
const error = ref('')
const success = ref('')
const logs = ref<string[]>([])
const showLogs = ref(false)

// Inject auth utilities from layout
const getAuthHeaders = inject<() => HeadersInit>('getAuthHeaders', () => ({}))

async function runUpdate() {
  // Prevent double-clicks
  if (updating.value) {
    return
  }

  if (!confirm('Run system update? This may take several minutes.')) {
    return
  }

  updating.value = true
  error.value = ''
  success.value = ''
  logs.value = []
  showLogs.value = true

  try {
    // Use EventSource for Server-Sent Events (GET request)
    const token = (getAuthHeaders() as any).Authorization?.split(' ')[1]
    const eventSource = new EventSource(
      `/api/system/update?token=${encodeURIComponent(token || '')}`
    )

    eventSource.addEventListener('log', (event) => {
      const data = JSON.parse(event.data)
      logs.value.push(data.message)

      // Auto-scroll to bottom
      nextTick(() => {
        const logContainer = document.querySelector('.log-output')
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight
        }
      })
    })

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data)
      eventSource.close()
      updating.value = false

      if (data.success) {
        success.value = data.message || 'System successfully updated'
        setTimeout(() => {
          success.value = ''
          showLogs.value = false
        }, 5000)
      } else {
        error.value = data.error || 'System update failed'
        setTimeout(() => {
          error.value = ''
        }, 10000)
      }
    })

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err)
      eventSource.close()
      updating.value = false
      error.value = 'Connection to server lost'
      setTimeout(() => {
        error.value = ''
      }, 10000)
    }
  } catch (err: any) {
    console.error('Update failed:', err)
    error.value = err?.data?.message || err?.message || 'System update failed'
    updating.value = false

    setTimeout(() => {
      error.value = ''
    }, 10000)
  }
}
</script>

<template>
  <div class="system-update">
    <button @click="runUpdate" :disabled="updating" class="update-button" :class="{ updating }">
      <span v-if="updating">
        <svg class="spinner" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
          <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Update running...
      </span>
      <span v-else>
        System Update
      </span>
    </button>

    <div v-if="showLogs && logs.length > 0" class="log-container">
      <div class="log-header">Update Logs:</div>
      <div class="log-output">
        <pre v-for="(log, index) in logs" :key="index">{{ log }}</pre>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">
      {{ success }}
    </div>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.system-update {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.update-button {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.update-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.update-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.update-button.updating {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.spinner {
  width: 1rem;
  height: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.alert-success {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.alert-error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.log-container {
  margin-top: 1rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.375rem;
  overflow: hidden;
  background: var(--bg-secondary, #f9fafb);
}

.log-header {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary, #f3f4f6);
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.log-output {
  max-height: 400px;
  overflow-y: auto;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
  background: var(--bg-code, #1e1e1e);
  color: var(--text-code, #d4d4d4);
}

.log-output pre {
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .alert-success {
    background-color: #064e3b;
    color: #6ee7b7;
    border-color: #047857;
  }

  .alert-error {
    background-color: #7f1d1d;
    color: #fca5a5;
    border-color: #991b1b;
  }

  .log-container {
    border-color: #374151;
    background: #1f2937;
  }

  .log-header {
    background: #111827;
    border-color: #374151;
  }
}
</style>
