<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const isLinux = ref(false)
const hostManagerAvailable = ref(false)
const checkingHostManager = ref(true)
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

// Check platform and host-manager status
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
    checkingHostManager.value = false
    return
  }

  // Check host-manager service status
  try {
    const response = await fetch('/api/system/host-manager-status', {
      headers: getAuthHeaders()
    })
    const data = await response.json()
    hostManagerAvailable.value = data.available

    if (!data.available) {
      error.value = 'Host manager service is not available. Please ensure the service is running.'
    }
  } catch (err) {
    console.error('Failed to check host-manager status:', err)
    hostManagerAvailable.value = false
    error.value = 'Could not check host manager status'
  } finally {
    checkingHostManager.value = false
  }

  await loadStepDefinitions()
  initializeSteps()
})

async function runUpdate() {
  // Prevent double-clicks
  if (updating.value) {
    return
  }

  // Check host-manager availability before starting
  if (!hostManagerAvailable.value) {
    error.value = 'Host manager service is not available. Please check the service status.'
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

    <div v-else-if="checkingHostManager" class="platform-warning">
      <div class="alert alert-info">
        <p>🔍 Checking host manager service...</p>
      </div>
    </div>

    <div v-else-if="!hostManagerAvailable" class="platform-warning">
      <div class="alert alert-error">
        <h2>⚠️ Host Manager Service Not Available</h2>
        <p>The host manager service is required for system updates but is not currently running.</p>
        <h3>Troubleshooting Steps:</h3>
        <ol>
          <li>Check if the service is running:
            <pre>docker service ls | grep host-manager</pre>
          </li>
          <li>Check service logs:
            <pre>docker service logs swarm-config_host-manager</pre>
          </li>
          <li>Verify the host-manager image exists:
            <pre>docker images | grep host-manager</pre>
          </li>
          <li>If the image is missing, rebuild it:
            <pre>cd /var/apps/swarm-config/host-manager && docker build -t host-manager:latest .</pre>
          </li>
          <li>Redeploy the stack:
            <pre>cd /var/apps/swarm-config && docker stack deploy -c compose.yaml swarm-config</pre>
          </li>
        </ol>
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

    <div v-if="isLinux && !checkingHostManager && hostManagerAvailable" class="update-section">
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

.alert-info {
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  border-radius: 8px;
  padding: 1.5rem;
  color: #0c5460;
}

.alert-info p {
  margin: 0;
  font-size: 1rem;
}

.alert-error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  padding: 2rem;
  color: #721c24;
}

.alert-error h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  color: #721c24;
}

.alert-error h3 {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.2rem;
  color: #721c24;
}

.alert-error p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.alert-error ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

.alert-error li {
  margin: 0.75rem 0;
}

.alert-error pre {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.5rem 0;
  overflow-x: auto;
  font-size: 0.875rem;
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
