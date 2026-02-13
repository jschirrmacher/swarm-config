<script setup lang="ts">
import type { CreateRepoRequest } from '~/types'

const props = defineProps<{
  creating: boolean
}>()

const emit = defineEmits<{
  submit: [data: CreateRepoRequest]
}>()

const form = ref<CreateRepoRequest>({
  name: '',
  port: 3000
})

function handleSubmit() {
  if (form.value.name) {
    emit('submit', { ...form.value })
    form.value = { name: '', port: 3000 }
  }
}
</script>

<template>
  <section class="create-section">
    <h3>Create New Project</h3>
    <form @submit.prevent="handleSubmit" class="create-form">
      <div class="service-basics">
        <div class="form-group">
          <label for="repoName">Project Name</label>
          <input id="repoName" v-model="form.name" type="text" placeholder="my-awesome-app" pattern="[a-z0-9-]+"
            required :disabled="creating" class="form-input" />
          <small>Only lowercase letters, numbers, and hyphens</small>
        </div>

        <div class="form-group">
          <label for="repoPort">Port</label>
          <input id="repoPort" v-model.number="form.port" type="number" min="1000" max="65535" placeholder="3000"
            :disabled="creating" class="form-input" />
          <small>Port your application listens on</small>
        </div>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="creating">
        {{ creating ? 'Creating...' : '+ Create Project' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.create-section {
  background: var(--bg-secondary);
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow);
  margin-top: 3rem;
  transition: background-color 0.3s ease;
}

.create-section h3 {
  margin-bottom: 1.5rem;
  color: var(--text-primary);
  text-align: center;
}

.create-form {
  max-width: 600px;
  margin: 0 auto;
}

.service-basics {
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-input:disabled {
  background: var(--border-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
