<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

defineProps<{
  currentUser?: string | null
  showLogout?: boolean
}>()

const emit = defineEmits<{
  logout: []
}>()

const isOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

function handleLogout() {
  emit('logout')
  closeMenu()
}

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="user-menu" ref="menuRef">
    <button @click="toggleMenu" class="menu-trigger" :title="currentUser || 'Menu'">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
        <path
          d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z" />
      </svg>
      <span class="menu-label">{{ currentUser || 'Menu' }}</span>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" class="chevron"
        :class="{ 'chevron-open': isOpen }">
        <path fill-rule="evenodd"
          d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
      </svg>
    </button>

    <transition name="dropdown">
      <div v-if="isOpen" class="menu-dropdown">
        <div v-if="currentUser" class="menu-section user-section">
          <span class="user-label">Logged in as</span>
          <span class="user-name">{{ currentUser }}</span>
        </div>

        <button v-if="showLogout" @click="handleLogout" class="menu-item">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M10 3.5a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 1 1 0v2A1.5 1.5 0 0 1 9.5 14h-8A1.5 1.5 0 0 1 0 12.5v-9A1.5 1.5 0 0 1 1.5 2h8A1.5 1.5 0 0 1 11 3.5v2a.5.5 0 0 1-1 0v-2z" />
            <path
              d="M4.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H14.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z" />
          </svg>
          Logout
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
}

.menu-trigger {
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

.menu-trigger:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px var(--shadow);
}

.menu-label {
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  transition: transform 0.2s ease;
}

.chevron-open {
  transform: rotate(180deg);
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 250px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px var(--shadow);
  overflow: hidden;
  z-index: 100;
}

.menu-section {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.menu-section:last-child {
  border-bottom: none;
}

.user-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-name {
  font-weight: 600;
  color: var(--accent);
  font-size: 1rem;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  border-top: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  text-align: left;
}

.menu-item:hover {
  background: var(--bg-primary);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 768px) {
  .menu-label {
    display: none;
  }

  .menu-dropdown {
    right: -1rem;
    min-width: 200px;
  }
}
</style>
