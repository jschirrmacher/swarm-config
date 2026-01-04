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
  <button @click="toggleColorMode" class="color-mode-toggle" :title="`Theme: ${getLabel()}`">
    <span class="icon">{{ getIcon() }}</span>
  </button>
</template>

<style scoped>
.color-mode-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 40px;
  height: 40px;
}

.color-mode-toggle:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--shadow);
}

.icon {
  font-size: 1.25rem;
  line-height: 1;
}
</style>
