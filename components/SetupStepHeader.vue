<script setup lang="ts">
interface Props {
  step: any
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
  <div class="log-header clickable" :class="step.status" @click="emit('toggle')">
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
      <button v-if="!step.inputs || step.inputs.length === 0" @click.stop="emit('run')" :disabled="running"
        class="run-button">
        Run
      </button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
