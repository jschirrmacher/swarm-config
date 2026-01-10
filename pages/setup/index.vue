<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { steps, loading, logs, running, fetchSteps, runAllSteps, runStep } = useSetup()

const inlineInputValues = ref<Record<string, Record<string, any>>>({})
const success = ref('')
const error = ref('')

onMounted(() => {
  fetchSteps()
})

// Initialize inline input values when steps are loaded
watch(steps, (newSteps) => {
  newSteps.forEach((step: any) => {
    if (step.inputs && step.inputs.length > 0) {
      if (!inlineInputValues.value[step.id]) {
        inlineInputValues.value[step.id] = {}
      }
      const stepInputs = inlineInputValues.value[step.id]
      if (stepInputs) {
        step.inputs.forEach((input: any) => {
          if (stepInputs[input.name] === undefined) {
            stepInputs[input.name] = input.value ?? input.default ?? (input.type === 'boolean' ? false : '')
          }
        })
      }
    }
  })
}, { immediate: true })

const handleRunStep = async (step: any) => {
  error.value = ''
  success.value = ''

  if (step.inputs && step.inputs.length > 0) {
    await runStep(step.id, inlineInputValues.value[step.id])
  } else {
    await runStep(step.id)
  }
}

const toggleStep = (stepId: string) => {
  const step = steps.value.find(s => s.id === stepId)
  if (step) {
    step.expanded = !step.expanded
  }
}

const runAll = async () => {
  error.value = ''
  success.value = ''
  try {
    await runAllSteps()
    success.value = 'All automatic setup steps completed successfully'
  } catch (err: any) {
    error.value = err?.message || 'Setup failed'
  }
}
</script>

<template>
  <div class="container">
    <nav class="breadcrumb">
      <NuxtLink to="/">← Back to Repositories</NuxtLink>
    </nav>

    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>System Setup</h1>
          <p class="subtitle">Configure and manage individual system setup steps</p>
        </div>
        <button @click="runAll()" :disabled="running || loading" class="run-button">
          {{ running ? 'Running...' : 'Run All Steps' }}
        </button>
      </div>
    </div>

    <div class="setup-section">
      <AppAlert v-if="success" type="success" :message="success" />
      <AppAlert v-if="error" type="error" :message="error" />

      <AppLoading v-if="loading" />

      <ul v-else class="steps-list">
        <li v-for="step in steps" :key="step.id" class="step-item" :class="step.status">
          <div class="log-header clickable" :class="step.status" @click="toggleStep(step.id)">
            <div class="header-left">
              <svg class="expand-icon" :class="{ expanded: step.expanded }" viewBox="0 0 24 24" fill="none"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              <div class="step-info">
                <div class="step-title-line">
                  <span class="step-title">{{ step.name }}</span>
                  <span v-if="step.isComplete && step.status === 'completed'" class="completion-badge">
                    ✓ Already complete
                  </span>
                  <span v-else-if="step.status === 'running'" class="status-badge running">Running</span>
                  <span v-else-if="step.status === 'failed'" class="status-badge failed">✗ Failed</span>
                </div>
                <div v-if="step.description" class="step-description">{{ step.description }}</div>
                <div class="step-status">
                  <span v-if="step.lastRun">
                    Last run: {{ new Date(step.lastRun).toLocaleString() }}
                  </span>
                  <span v-else class="text-muted">
                    Not executed yet
                  </span>
                </div>
              </div>
            </div>
            <div class="header-right">
              <span v-if="step.manualOnly" class="manual-badge" title="Manual execution only">
                Manual
              </span>
              <button v-if="!step.inputs || step.inputs.length === 0" @click.stop="handleRunStep(step)"
                :disabled="running" class="run-button">
                Run
              </button>
            </div>
          </div>
          <!-- Show input fields if step has inputs -->
          <div v-show="step.expanded" v-if="step.inputs && step.inputs.length > 0 && inlineInputValues[step.id]"
            class="step-inputs">
            <div class="inputs-header">Configuration</div>
            <div class="input-grid">
              <div v-for="input in step.inputs" :key="input.name" class="input-item-editable">
                <label class="input-label">
                  {{ input.label }}
                  <span v-if="input.required" class="text-red-500">*</span>
                </label>

                <div v-if="input.type === 'boolean'" class="flex items-center">
                  <input type="checkbox" v-model="inlineInputValues[step.id]![input.name]"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                </div>

                <input v-else-if="input.type === 'password'" type="password"
                  v-model="inlineInputValues[step.id]![input.name]" :placeholder="input.default" class="input-field">

                <input v-else-if="input.type === 'text'" type="text" v-model="inlineInputValues[step.id]![input.name]"
                  :placeholder="input.default" class="input-field">

                <select v-else-if="input.type === 'select'" v-model="inlineInputValues[step.id]![input.name]"
                  class="input-field">
                  <option v-for="option in input.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>

                <div v-if="input.description" class="input-description">{{ input.description }}</div>
              </div>
            </div>
            <div class="input-actions">
              <button @click="handleRunStep(step)" :disabled="running" class="run-button-small">
                {{ running ? 'Running...' : 'Run with these settings' }}
              </button>
            </div>
          </div>
          <div v-show="step.expanded" class="log-output step-logs">
            <!-- Show logs -->
            <div v-if="step.logs && step.logs.length > 0" class="logs-section">
              <div class="logs-header">Logs</div>
              <pre v-for="(log, logIndex) in step.logs" :key="logIndex">{{ log }}</pre>
            </div>
            <div v-else-if="!step.inputs || step.inputs.length === 0" class="no-logs">No logs yet...</div>
          </div>
        </li>
      </ul>
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
  color: var(--color-primary);
  text-decoration: none;
  font-size: 0.875rem;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 2rem;
}

.header-content h1 {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: rgb(107 114 128);
  font-size: 0.875rem;
}

.dark .subtitle {
  color: rgb(156 163 175);
}

.setup-section {
  margin-top: 2rem;
}

/* Step List Styles - matching SystemUpdateStepItem */
.steps-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step-item {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--bg-secondary, #f9fafb);
  transition: all 0.3s;
}

.step-item.pending {
  border-color: #d1d5db;
}

.step-item.running {
  border-color: #60a5fa;
  background: rgba(96, 165, 250, 0.05);
}

.step-item.completed {
  border-color: #10b981;
}

.step-item.failed {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  gap: 1rem;
}

.log-header.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.log-header.clickable:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.03));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.expand-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  transition: transform 0.2s;
  color: var(--text-secondary, #6b7280);
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.step-info {
  flex: 1;
  min-width: 0;
}

.step-title-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.step-title {
  font-weight: 600;
  color: var(--text-primary, #111827);
  font-size: 0.95rem;
}

.dark .step-title {
  color: #f3f4f6;
}

.step-description {
  font-size: 0.8rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.25rem;
}

.dark .step-description {
  color: #9ca3af;
}

.step-status {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  margin-top: 0.25rem;
  font-style: italic;
}

.dark .step-status {
  color: #6b7280;
}

.completion-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: #d1fae5;
  color: #065f46;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 9999px;
}

.dark .completion-badge {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 9999px;
}

.status-badge.running {
  background: #dbeafe;
  color: #1e40af;
}

.dark .status-badge.running {
  background: rgba(96, 165, 250, 0.2);
  color: #93c5fd;
}

.status-badge.failed {
  background: #fee2e2;
  color: #991b1b;
}

.dark .status-badge.failed {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.manual-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 9999px;
}

.dark .manual-badge {
  background: rgba(251, 191, 36, 0.2);
  color: #fcd34d;
}

.run-button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.run-button:hover:not(:disabled) {
  background: #2563eb;
}

.run-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.log-output {
  background: var(--log-bg, #1f2937);
  color: var(--log-text, #f3f4f6);
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-x: auto;
  border-top: 1px solid var(--border-color, #374151);
}

.log-output pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.no-logs {
  color: var(--text-muted, #9ca3af);
  font-style: italic;
}

/* Step Inputs Display */
.step-inputs {
  padding: 1rem;
  background: var(--bg-secondary, #f9fafb);
}

.dark .step-inputs {
  background: rgba(55, 65, 81, 0.3);
}

.inputs-header {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #111827);
}

.dark .inputs-header {
  color: #f3f4f6;
}

.input-grid {
  display: grid;
  gap: 1rem;
}

.input-item-editable {
  display: grid;
  gap: 0.5rem;
}

.input-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  display: block;
}

.dark .input-label {
  color: #f3f4f6;
}

.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 0.375rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #111827);
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.dark .input-field {
  background: #374151;
  border-color: #4b5563;
  color: #f3f4f6;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-description {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  font-style: italic;
  margin-top: -0.25rem;
}

.input-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.run-button-small {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.run-button-small:hover:not(:disabled) {
  background: #2563eb;
}

.run-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logs-section {
  padding: 1rem;
}

.logs-header {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.dark .logs-header {
  color: #f3f4f6;
}
</style>