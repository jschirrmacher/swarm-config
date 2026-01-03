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
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.alert-success {
  background: #efe;
  color: #2a2;
  border: 1px solid #cfc;
}

.alert-info {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}
</style>
