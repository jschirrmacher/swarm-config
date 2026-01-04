<script setup lang="ts">
import type { Step } from '~/composables/useSystemUpdate'

defineProps<{
  step: Step
}>()

defineEmits<{
  toggle: []
}>()

const statusBadges = {
  completed: '✓ Completed',
  failed: '✗ Failed',
  running: 'Running',
  pending: 'Pending'
} as const
</script>

<template>
  <li class="step-item" :class="step.status">
    <div class="log-header clickable" :class="step.status" @click="$emit('toggle')">
      <div class="header-left">
        <svg class="expand-icon" :class="{ expanded: step.expanded }" viewBox="0 0 24 24" fill="none"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span class="step-title">{{ step.title }}</span>
        <span class="status-badge" :class="step.status">{{ statusBadges[step.status] }}</span>
      </div>
      <span class="log-count">{{ step.logs.length }} lines</span>
    </div>
    <div v-show="step.expanded" class="log-output step-logs">
      <pre v-for="(log, logIndex) in step.logs" :key="logIndex">{{ log }}</pre>
      <div v-if="step.logs.length === 0" class="no-logs">No logs yet...</div>
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
  opacity: 0.7;
}

.step-item.completed {
  border-color: #10b981;
  border-width: 2px;
}

.step-item.running {
  border-color: #667eea;
  border-width: 2px;
  box-shadow: 0 0 10px rgba(102, 126, 234, 0.2);
}

.step-item.failed {
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

.log-header.clickable {
  cursor: pointer;
  user-select: none;
}

.log-header.clickable:hover {
  background: var(--bg-hover, #e5e7eb);
}

.log-header.completed {
  background: #d1fae5;
}

.log-header.failed {
  background: #fee2e2;
}

.log-header.running {
  background: #dbeafe;
}

.log-header.pending {
  background: var(--bg-tertiary, #f3f4f6);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.expand-icon {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.step-title {
  flex: 1;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.completed {
  background: #10b981;
  color: white;
}

.status-badge.failed {
  background: #ef4444;
  color: white;
}

.status-badge.running {
  background: #3b82f6;
  color: white;
}

.status-badge.pending {
  background: #9ca3af;
  color: white;
}

.log-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

.log-output {
  max-height: 400px;
  overflow-y: auto;
  background: var(--bg-primary, #ffffff);
}

.step-logs {
  padding: 1rem;
}

.step-logs pre {
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.no-logs {
  color: var(--text-secondary);
  font-style: italic;
  opacity: 0.7;
}

@media (prefers-color-scheme: dark) {
  .step-item {
    border-color: #374151;
    background: #1f2937;
  }

  .step-item.pending {
    border-color: #4b5563;
  }

  .step-item.completed {
    border-color: #10b981;
  }

  .step-item.running {
    border-color: #667eea;
  }

  .step-item.failed {
    border-color: #ef4444;
  }

  .log-header {
    background: #111827;
    border-color: #374151;
  }

  .log-header.clickable:hover {
    background: #1f2937;
  }

  .log-header.completed {
    background: #065f46;
  }

  .log-header.failed {
    background: #7f1d1d;
  }

  .log-header.running {
    background: #1e3a8a;
  }

  .log-header.pending {
    background: #1f2937;
  }

  .log-output {
    background: #111827;
  }
}
</style>
