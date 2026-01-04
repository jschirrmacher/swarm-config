<script setup lang="ts">
const colorMode = useColorMode()

const toggleColorMode = () => {
  const modes: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']
  const currentIndex = modes.indexOf(colorMode.preference as 'system' | 'light' | 'dark')
  const nextIndex = (currentIndex + 1) % modes.length
  colorMode.preference = modes[nextIndex] as 'system' | 'light' | 'dark'
}

const getIcon = () => {
  if (colorMode.preference === 'system') return '🌗'
  if (colorMode.preference === 'dark') return '🌙'
  return '☀️'
}

const getLabel = () => {
  if (colorMode.preference === 'system') return 'System'
  if (colorMode.preference === 'dark') return 'Dark'
  return 'Light'
}
</script>

<template>
  <button @click="toggleColorMode" class="color-mode-toggle" :title="`Current: ${getLabel()}`">
    <span class="icon">{{ getIcon() }}</span>
    <span class="label">{{ getLabel() }}</span>
  </button>
</template>

<style scoped>
.color-mode-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.color-mode-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow);
  border-color: var(--accent);
}

.icon {
  font-size: 1.2rem;
  line-height: 1;
}

.label {
  font-weight: 500;
}
</style>
