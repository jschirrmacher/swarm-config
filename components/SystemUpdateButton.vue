<script setup lang="ts">
defineProps<{
  updating: boolean
  reconnecting: boolean
  completed: boolean
  success: string
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button @click="$emit('click')" :disabled="updating || reconnecting" class="update-button"
    :class="{ updating: updating || reconnecting, completed: completed && !!success }">
    <span v-if="reconnecting">
      <UpdateIcon :rotating="true" />
      Reconnecting...
    </span>
    <span v-else-if="updating">
      <UpdateIcon :rotating="true" />
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
      <UpdateIcon />
      Start System Update
    </span>
  </button>
</template>

<style scoped>
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

.update-button span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
</style>
