<script setup lang="ts">
defineProps<{
  subtitle?: string
  currentUser?: string | null
  showLogout?: boolean
  showSystemUpdate?: boolean
}>()

const emit = defineEmits<{
  logout: []
}>()

function handleLogout() {
  emit('logout')
}
</script>

<template>
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="title-section">
          <span class="logo">🐳</span>
          <div>
            <h1>Swarm Config</h1>
            <p class="subtitle">{{ subtitle }}</p>
          </div>
        </div>
        <div class="header-actions">
          <SystemUpdate v-if="showSystemUpdate" />
          <ColorModeToggle />
          <UserMenu :current-user="currentUser" :show-logout="showLogout" @logout="handleLogout" />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: var(--bg-secondary);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 20px var(--shadow);
  padding: 1.5rem 0;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  font-size: 3.5rem;
  line-height: 1;
}

h1 {
  margin: 0;
  font-size: 2rem;
  color: var(--accent);
}

.subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  .header-content {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
}
</style>
