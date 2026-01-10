<script setup lang="ts">
interface Props {
  step: any
  inputValues: Record<string, any>
  running: boolean
}

interface Emits {
  (e: 'toggle'): void
  (e: 'run'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <li class="step-item" :class="step.status">
    <SetupStepHeader :step="step" :running="running" @toggle="emit('toggle')" @run="emit('run')" />

    <SetupStepInputs v-show="step.expanded" v-if="step.inputs && step.inputs.length > 0 && inputValues"
      :inputs="step.inputs" :step-id="step.id" :input-values="inputValues" :running="running" @run="emit('run')" />

    <div v-show="step.expanded" class="log-output step-logs">
      <div v-if="step.logs && step.logs.length > 0" class="logs-section">
        <div class="logs-header">Logs</div>
        <pre v-for="(log, logIndex) in step.logs" :key="logIndex">{{ log }}</pre>
      </div>
      <div v-else class="no-logs">No logs yet...</div>
    </div>
  </li>
</template>

<style scoped>
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

.logs-header {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.dark .logs-header {
  color: #f3f4f6;
}

.no-logs {
  color: var(--text-muted, #9ca3af);
  font-style: italic;
}
</style>
