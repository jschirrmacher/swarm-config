<script setup lang="ts">
defineProps<{
  message?: string
  type?: 'success' | 'error' | 'info'
}>()
</script>

<template>
  <div v-if="message" :class="['alert', `alert-${type}`]">
    <pre v-if="message.includes('\n')" class="alert-pre">{{ message }}</pre>
    <span v-else>{{ message }}</span>
  </div>
</template>

<style scoped>
.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1.5rem;
}

.alert-pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.alert-error {
  background: rgba(255, 0, 0, 0.1);
  color: #dc2626;
  border: 1px solid rgba(255, 0, 0, 0.3);
}

.dark .alert-error {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.4);
}

.alert-success {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.dark .alert-success {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.4);
}

.alert-info {
  background: rgba(103, 126, 234, 0.1);
  color: #667eea;
  border: 1px solid rgba(103, 126, 234, 0.3);
}

.dark .alert-info {
  background: rgba(124, 143, 239, 0.15);
  color: #8fa1f5;
  border-color: rgba(124, 143, 239, 0.4);
}
</style>
