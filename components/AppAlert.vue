<script setup lang="ts">
defineProps<{
  message?: string
  type?: 'success' | 'error' | 'info'
}>()
</script>

<template>
  <div v-if="message" :class="['alert', `alert-${type}`]">
    {{ message }}
  </div>
</template>

<style scoped>
.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1.5rem;
}

.alert-error {
  background: rgba(255, 0, 0, 0.1);
  color: #ff4444;
  border: 1px solid rgba(255, 0, 0, 0.3);
}

.dark .alert-error {
  background: rgba(255, 0, 0, 0.15);
  color: #ff6666;
  border-color: rgba(255, 0, 0, 0.4);
}

.alert-success {
  background: rgba(0, 255, 0, 0.1);
  color: #22aa22;
  border: 1px solid rgba(0, 255, 0, 0.3);
}

.dark .alert-success {
  background: rgba(0, 255, 0, 0.15);
  color: #44cc44;
  border-color: rgba(0, 255, 0, 0.4);
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
