<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { steps, loading, running, fetchSteps, runAllSteps, runStep } = useSetup()

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
        <SetupStepItem v-for="step in steps" :key="step.id" :step="step"
          :input-values="inlineInputValues[step.id] || {}" :running="running" @toggle="toggleStep(step.id)"
          @run="handleRunStep(step)" />
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

.steps-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
</style>