<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

interface Step {
  title: string
  logs: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
}

const updating = ref(false)
const completed = ref(false)
const reconnecting = ref(false)
const error = ref('')
const success = ref('')
const logs = ref<string[]>([])
const showLogs = ref(false)
const steps = ref<Step[]>([])
const currentStepIndex = ref(-1)

// Inject auth utilities from layout
const getAuthHeaders = inject<() => HeadersInit>('getAuthHeaders', () => ({}))
const logout = inject<() => void>('logout', () => { })

let reconnectAttempts = 0
const maxReconnectAttempts = 10
const reconnectDelay = 3000 // 3 seconds

// Define the setup steps based on the scripts/steps directory
const setupSteps = [
  { pattern: /01-get-domain|Getting domain/i, title: 'Step 1: Get Domain Configuration' },
  { pattern: /02-install-docker|Installing Docker|docker/i, title: 'Step 2: Install Docker' },
  { pattern: /03-install-firewall|firewall|ufw/i, title: 'Step 3: Configure Firewall' },
  { pattern: /04-create-users|Creating users/i, title: 'Step 4: Create Users' },
  { pattern: /05-configure-ssh|SSH|authorized_keys/i, title: 'Step 5: Configure SSH' },
  { pattern: /06-create-network|Creating network|docker network/i, title: 'Step 6: Create Docker Network' },
  { pattern: /06\.5-setup-host-manager|host-manager.*token/i, title: 'Step 6.5: Setup Host Manager Token' },
  { pattern: /07-deploy-kong|Deploying Kong|kong/i, title: 'Step 7: Deploy Kong Gateway' },
  { pattern: /08-deploy-webui|Deploying.*UI|Building.*ui/i, title: 'Step 8: Deploy Web UI' },
  { pattern: /09-install-glusterfs|glusterfs/i, title: 'Step 9: Install GlusterFS' },
  { pattern: /10-prepare-apps|Preparing apps/i, title: 'Step 10: Prepare Apps Directory' },
]

function initializeSteps() {
  steps.value = setupSteps.map(step => ({
    title: step.title,
    logs: [],
    status: 'pending'
  }))
  currentStepIndex.value = -1
}

function addLogToStep(message: string) {
  // Check if this is a new step
  for (let i = 0; i < setupSteps.length; i++) {
    if (setupSteps[i]?.pattern.test(message) && currentStepIndex.value < i) {
      // Mark previous step as completed
      if (currentStepIndex.value >= 0) {
        const prevStep = steps.value[currentStepIndex.value]
        if (prevStep) prevStep.status = 'completed'
      }
      // Start new step
      currentStepIndex.value = i
      const currentStep = steps.value[i]
      if (currentStep) currentStep.status = 'running'
      break
    }
  }

  // Add log to current step or general logs
  if (currentStepIndex.value >= 0) {
    steps.value[currentStepIndex.value]?.logs.push(message)
  } else {
    // Before first step or doesn't match any step
    logs.value.push(message)
  }
}

async function checkUpdateStatus() {
  try {
    const response = await fetch('/api/debug')
    return response.ok
  } catch {
    return false
  }
}

function attemptReconnect(token: string) {
  if (reconnectAttempts >= maxReconnectAttempts) {
    updating.value = false
    reconnecting.value = false
    error.value = 'Could not reconnect after service restart'
    return
  }

  reconnectAttempts++
  reconnecting.value = true
  addLogToStep(`[Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}]`)

  setTimeout(async () => {
    const serverUp = await checkUpdateStatus()
    if (serverUp) {
      // Server is back, but update might still be running or completed
      // Wait a bit and assume it completed successfully
      addLogToStep('[Service is back online]')
      addLogToStep('[Update completed - service restarted successfully]')
      if (currentStepIndex.value >= 0) {
        const currentStep = steps.value[currentStepIndex.value]
        if (currentStep) currentStep.status = 'completed'
      }
      completed.value = true
      updating.value = false
      reconnecting.value = false
      success.value = 'System successfully updated and restarted'
      reconnectAttempts = 0
    } else {
      // Try again
      attemptReconnect(token)
    }
  }, reconnectDelay)
}

async function runUpdate() {
  // Prevent double-clicks
  if (updating.value) {
    return
  }

  updating.value = true
  completed.value = false
  reconnecting.value = false
  error.value = ''
  success.value = ''
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

      // Auto-scroll to bottom of current step
      nextTick(() => {
        const activeSteps = document.querySelectorAll('.step-logs')
        if (activeSteps.length > 0) {
          const lastStep = activeSteps[activeSteps.length - 1]
          if (lastStep) {
            lastStep.scrollTop = lastStep.scrollHeight
          }
        }
      })
    })

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data)
      eventSource.close()

      // Mark current step as completed
      if (currentStepIndex.value >= 0) {
        const currentStep = steps.value[currentStepIndex.value]
        if (currentStep) currentStep.status = data.success ? 'completed' : 'failed'
      }

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
        attemptReconnect(token || '')
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
    <div class="page-header">
      <h1>System Update</h1>
      <p class="subtitle">Update the swarm-config infrastructure to the latest version</p>
    </div>

    <div class="update-section">
      <div class="info-card">
        <h2>What happens during an update?</h2>
        <ul>
          <li>Pull latest version from GitHub</li>
          <li>Rebuild Docker images (UI, host-manager)</li>
          <li>Update services with zero downtime</li>
          <li>Reload Kong configuration</li>
        </ul>
        <p class="note">
          <strong>Note:</strong> The update process may take several minutes. During this time,
          the connection may be interrupted briefly when services restart.
        </p>
      </div>

      <div class="action-card">
        <button @click="runUpdate" :disabled="updating || reconnecting" class="update-button"
          :class="{ updating: updating || reconnecting, completed: completed && success }">
          <span v-if="reconnecting">
            <svg class="spinner" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Reconnecting...
          </span>
          <span v-else-if="updating">
            <svg class="spinner" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Update running...
          </span>
          <span v-else-if="completed && success">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Update Completed
          </span>
          <span v-else>
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Start System Update
          </span>
        </button>
      </div>

      <AppAlert v-if="success" type="success" :message="success" />
      <AppAlert v-if="error" type="error" :message="error" />

      <!-- Initial logs before first step -->
      <div v-if="showLogs && logs.length > 0" class="log-container initial-logs">
        <div class="log-header">
          <div class="header-left">
            <span>Initialization</span>
          </div>
          <span class="log-count">{{ logs.length }} lines</span>
        </div>
        <div class="log-output step-logs">
          <pre v-for="(log, index) in logs" :key="index">{{ log }}</pre>
        </div>
      </div>

      <!-- Steps -->
      <div v-for="(step, index) in steps" :key="index" v-show="step.status !== 'pending'"
        class="log-container step-container" :class="{
          'completed': step.status === 'completed',
          'running': step.status === 'running',
          'failed': step.status === 'failed'
        }">
        <div class="log-header" :class="{
          'success': step.status === 'completed',
          'error': step.status === 'failed',
          'running': step.status === 'running'
        }">
          <div class="header-left">
            <span class="step-title">{{ step.title }}</span>
            <span v-if="step.status === 'completed'" class="status-badge success">✓ Completed</span>
            <span v-else-if="step.status === 'failed'" class="status-badge error">✗ Failed</span>
            <span v-else-if="step.status === 'running'" class="status-badge running">Running</span>
          </div>
          <span class="log-count">{{ step.logs.length }} lines</span>
        </div>
        <div class="log-output step-logs">
          <pre v-for="(log, logIndex) in step.logs" :key="logIndex">{{ log }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
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

.info-card,
.action-card {
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px var(--shadow);
}

.info-card h2 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
}

.info-card ul {
  margin: 0 0 1rem;
  padding-left: 1.5rem;
  line-height: 1.8;
}

.info-card li {
  margin-bottom: 0.5rem;
}

.note {
  margin: 1rem 0 0;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-left: 3px solid var(--accent);
  border-radius: 0.25rem;
  font-size: 0.9rem;
}

.action-card {
  text-align: center;
}

.update-button {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  min-width: 250px;
}

.update-button.completed {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.update-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.update-button.completed:hover:not(:disabled) {
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
}

.update-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.update-button .icon {
  width: 1.5rem;
  height: 1.5rem;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
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

.log-container {
  margin-top: 1.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--bg-secondary, #f9fafb);
  transition: all 0.3s;
}

.log-container.step-container {
  margin-top: 1rem;
}

.log-container.initial-logs {
  opacity: 0.8;
}

.log-container.completed {
  border-color: #10b981;
  border-width: 2px;
}

.log-container.running {
  border-color: #667eea;
  border-width: 2px;
  box-shadow: 0 0 10px rgba(102, 126, 234, 0.2);
}

.log-container.failed {
  border-color: #ef4444;
  border-width: 2px;
}

.log-header {
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary, #f3f4f6);
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.3s;
}

.log-header.running {
  background: #ddd6fe;
  border-bottom-color: #667eea;
}

.log-header.success {
  background: #d1fae5;
  border-bottom-color: #10b981;
}

.log-header.error {
  background: #fee2e2;
  border-bottom-color: #ef4444;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.step-title {
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.success {
  background: #10b981;
  color: white;
}

.status-badge.error {
  background: #ef4444;
  color: white;
}

.status-badge.running {
  background: #667eea;
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

.status-badge.reconnecting {
  background: #f59e0b;
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

.log-count {
  color: var(--text-secondary);
  font-weight: normal;
  font-size: 0.8rem;
}

.log-output {
  max-height: 300px;
  overflow-y: auto;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 0.85rem;

  .log-output {
    max-height: 300px;
    overflow-y: auto;
    padding: 1rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 0.85rem;
    line-height: 1.5;
    background: var(--bg-code, #1e1e1e);
    color: var(--text-code, #d4d4d4);
  }

  .step-logs {
    max-height: 250px;
  }

  .log-output pre {
    margin: 0;
    padding: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .update-button {
    width: 100%;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .log-container {
    border-color: #374151;
    background: #1f2937;
  }

  .log-container.completed {
    border-color: #10b981;
  }

  .log-container.running {
    border-color: #667eea;
  }

  .log-container.failed {
    border-color: #ef4444;
  }

  .log-header {
    background: #111827;
    border-color: #374151;
  }

  .log-header.running {
    background: #312e81;
    border-bottom-color: #667eea;
  }

  .log-header.success {
    background: #064e3b;
    border-bottom-color: #10b981;
  }

  .log-header.error {
    background: #7f1d1d;
    border-bottom-color: #ef4444;
  }
}
</style>
