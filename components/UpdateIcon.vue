<script setup lang="ts">
defineProps<{
  rotating?: boolean
}>()
</script>

<template>
  <svg class="icon" :class="{ rotating }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
</template>

<style scoped>
.icon {
  width: 1.5rem;
  height: 1.5rem;
}

.icon.rotating {
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
</style>
