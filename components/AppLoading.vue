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
  color: #666;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}
</style>
