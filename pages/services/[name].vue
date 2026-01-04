<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const serviceName = computed(() => route.params.name as string)

const service = ref<any>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveSuccess = ref(false)
const domain = ref('')
const activeTab = ref<'kong' | 'compose'>('kong')

// Inject auth utilities from layout
const getAuthHeaders = inject<() => HeadersInit>('getAuthHeaders', () => ({}))

onMounted(async () => {
  await loadService()
})

async function loadService() {
  try {
    loading.value = true
    error.value = ''

    const response = await fetch(`/api/services/${serviceName.value}`, {
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to load service: ${response.statusText}`)
    }

    const data = await response.json()
    service.value = data
    domain.value = data.domain || ''
  } catch (err: any) {
    error.value = err.message || 'Failed to load service configuration'
    console.error('Error loading service:', err)
  } finally {
    loading.value = false
  }
}

async function saveService() {
  if (!service.value) return

  try {
    saving.value = true
    error.value = ''
    saveSuccess.value = false

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }

    const payload: any = {}

    // Only send the content that has changed
    if (activeTab.value === 'kong') {
      payload.kong = service.value.kong.content
    } else {
      payload.compose = service.value.compose.content
    }

    const response = await fetch(`/api/services/${serviceName.value}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Failed to save service: ${response.statusText}`)
    }

    saveSuccess.value = true
    setTimeout(() => {
      saveSuccess.value = false
    }, 3000)
  } catch (err: any) {
    error.value = err.message || 'Failed to save service configuration'
    console.error('Error saving service:', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container">
    <nav class="breadcrumb">
      <NuxtLink to="/">← Back to Repositories</NuxtLink>
    </nav>

    <AppLoading v-if="loading" text="Loading service configuration..." />

    <AppAlert v-else-if="error" type="error" :message="error" />

    <section v-else-if="service" class="service-detail">
      <div class="service-header">
        <h2>{{ service.name }}</h2>
      </div>

      <!-- Tabs for switching between kong.yaml and docker-compose.yaml -->
      <div class="tabs">
        <button :class="{ active: activeTab === 'kong' }" @click="activeTab = 'kong'" class="tab-button">
          Kong Configuration
        </button>
        <button :class="{ active: activeTab === 'compose' }" @click="activeTab = 'compose'" class="tab-button">
          Docker Compose
        </button>
      </div>

      <div class="code-section">
        <!-- Kong YAML Editor -->
        <div v-if="activeTab === 'kong'" class="editor-container">
          <textarea v-model="service.kong.content" class="code-editor" spellcheck="false"
            placeholder="Kong configuration (YAML)"></textarea>
        </div>

        <!-- Docker Compose YAML Editor -->
        <div v-else class="editor-container">
          <textarea v-model="service.compose.content" class="code-editor" spellcheck="false"
            placeholder="Docker Compose configuration (YAML)"></textarea>
        </div>
      </div>

      <div class="actions-footer">
        <button @click="saveService" :disabled="saving" class="btn-save">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <span v-if="saveSuccess" class="save-success">✓ Saved successfully</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.breadcrumb {
  margin-bottom: 2rem;
}

.breadcrumb a {
  color: white;
  text-decoration: none;
  font-size: 0.95rem;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.breadcrumb a:hover {
  opacity: 1;
  text-decoration: underline;
}

.service-detail {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
}

.service-header h2 {
  margin: 0;
  color: #333;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e1e4e8;
}

.tab-button {
  background: transparent;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  color: #666;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #667eea;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
  font-weight: 600;
}

.code-section {
  margin-top: 1rem;
}

.editor-container {
  width: 100%;
}

.code-editor {
  width: 100%;
  min-height: 500px;
  background: #f8f9fa;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  padding: 1.5rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #24292e;
  resize: vertical;
  overflow: auto;
}

.code-editor:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.actions-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
}

.btn-save {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
  background: #5568d3;
}

.btn-save:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.save-success {
  color: #4caf50;
  font-size: 0.9rem;
  font-weight: 500;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .service-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  .code-editor {
    padding: 1rem;
    font-size: 0.85rem;
  }
}
</style>
