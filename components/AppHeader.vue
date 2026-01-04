<script setup lang="ts">
defineProps<{
  subtitle?: string
  currentUser?: string | null
  showLogout?: boolean
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
          <ColorModeToggle />
          <div v-if="currentUser" class="user-info">
            <span class="user-label">Logged in as:</span>
            <span class="user-name">{{ currentUser }}</span>
            <button v-if="showLogout" @click="handleLogout" class="btn-logout" title="Logout">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path
                  d="M10 3.5a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 1 1 0v2A1.5 1.5 0 0 1 9.5 14h-8A1.5 1.5 0 0 1 0 12.5v-9A1.5 1.5 0 0 1 1.5 2h8A1.5 1.5 0 0 1 11 3.5v2a.5.5 0 0 1-1 0v-2z" />
                <path
                  d="M4.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H14.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z" />
              </svg>
              Logout
            </button>
          </div>
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
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.user-label {
  font-size: 0.9rem;
}

.user-name {
  font-weight: 600;
  color: var(--accent);
}

.btn-logout {
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: var(--accent);
  color: white;
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

  .header-actions {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
