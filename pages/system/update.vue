<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const isLinux = ref(false)
const updating = ref(false)
const completed = ref(false)
const error = ref('')
const success = ref('')

// Inject auth utilities from layout
const getAuthHeaders = inject<() => HeadersInit>('getAuthHeaders', () => ({}))

// Use composables
const {
  steps,
  hasMatchedStepPattern,
  loadStepDefinitions,
  initializeSteps,
  toggleStep,
  addLogToStep,
  markCurrentStepCompleted,
  markCurrentStepStatus,
  markRemainingStepsCompleted,
} = useSystemUpdate()

const { reconnecting, attemptReconnect, resetReconnectAttempts } = useUpdateReconnect()

// Check platform and load steps
onMounted(async () => {
  // Check if server is running on Linux
  try {
    const response = await fetch('/api/system/platform')
    const data = await response.json()
    isLinux.value = data.platform === 'linux'
  } catch {
    isLinux.value = false
  }

  if (!isLinux.value) {
    return
  }
  await loadStepDefinitions()
  initializeSteps()
})

async function runUpdate() {
  // Prevent double-clicks
  if (updating.value) {
    return
  }

  updating.value = true
  completed.value = false
  error.value = ''
  success.value = ''
  resetReconnectAttempts()
  await loadStepDefinitions()
  initializeSteps()

  try {
    // Use EventSource for Server-Sent Events (GET request)
    const token = (getAuthHeaders() as any).Authorization?.split(' ')[1]
    const eventSource = new EventSource(
      `/api/system/update?token=${encodeURIComponent(token || '')}`
    )

    eventSource.addEventListener('log', (event) => {
      const data = JSON.parse(event.data)
      addLogToStep(data.message)

      // Auto-scroll to active step
      nextTick(() => {
        // Scroll the running step into view
        const runningStep = document.querySelector('.step-item.running')
        if (runningStep) {
          runningStep.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }

        // Scroll all expanded log outputs to the bottom
        const expandedLogs = document.querySelectorAll('.step-logs')
        expandedLogs.forEach(logElement => {
          logElement.scrollTop = logElement.scrollHeight
        })
      })
    })

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data)
      eventSource.close()

      // Mark current step as completed or failed
      markCurrentStepStatus(data.success ? 'completed' : 'failed')

      completed.value = true
      updating.value = false

      if (data.success) {
        success.value = data.message || 'System successfully updated'
      } else {
        error.value = data.error || 'System update failed'
      }
    })

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err)
      eventSource.close()

      // If update was running, this is expected - service is restarting
      if (updating.value && !completed.value) {
        addLogToStep('[Connection lost - service is restarting...]')
        attemptReconnect(token || '', {
          onLog: addLogToStep,
          onSuccess: () => {
            markRemainingStepsCompleted()
            completed.value = true
            updating.value = false
            success.value = 'System successfully updated and restarted'
          },
          onError: (message) => {
            updating.value = false
            error.value = message
          },
          hasMatchedStepPattern: hasMatchedStepPattern.value,
        })
      } else {
        updating.value = false
        error.value = 'Connection to server lost'
      }
    }
  } catch (err: any) {
    console.error('Update failed:', err)
    error.value = err?.data?.message || err?.message || 'System update failed'
    updating.value = false

    setTimeout(() => {
      error.value = ''
    }, 15000)
  }
}
</script>

<template>
  <div class="container">
    <nav class="breadcrumb">
      <NuxtLink to="/">← Back to Repositories</NuxtLink>
    </nav>

    <div v-if="!isLinux" class="platform-warning">
      <div class="alert alert-warning">
        <h2>⚠️ System Updates Not Available</h2>
        <p>System updates are only available on Linux servers.</p>
        <p>This feature uses Linux-specific package management and system commands.</p>
      </div>
    </div>

    <div v-else class="page-header">
      <div class="header-content">
        <div>
          <h1>System Update</h1>
          <p class="subtitle">Update the swarm-config infrastructure to the latest version</p>
        </div>
        <SystemUpdateButton :updating="updating" :reconnecting="reconnecting" :completed="completed" :success="success"
          @click="runUpdate" />
      </div>
    </div>

    <div v-if="isLinux" class="update-section">
      <AppAlert v-if="success" type="success" :message="success" />
      <AppAlert v-if="error" type="error" :message="error" />

      <SystemUpdateStepList :steps="steps" @toggle-step="toggleStep" />
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
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

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.page-header h1 {
  margin: 0;
  font-size: 2rem;
  color: var(--accent);
}

.subtitle {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
  font-size: 1rem;
}

.update-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.platform-warning {
  margin-top: 2rem;
}

.alert-warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 2rem;
  color: #856404;
}

.alert-warning h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  color: #856404;
}

.alert-warning p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
