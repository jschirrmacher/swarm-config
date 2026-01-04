<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

<template>
  <div class="loading">
    {{ text }}
  </div>
</template>

<style scoped>
.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 30px var(--shadow);
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>
