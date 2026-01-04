<script setup lang="ts">
import type { Step } from '~/composables/useSystemUpdate'

defineProps<{
  steps: Step[]
}>()

defineEmits<{
  'toggle-step': [index: number]
}>()
</script>

<template>
  <ul class="steps-list">
    <SystemUpdateStepItem v-for="(step, index) in steps" :key="index" :step="step"
      @toggle="$emit('toggle-step', index)" />
  </ul>
</template>

<style scoped>
.steps-list {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
