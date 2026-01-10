<script setup lang="ts">
interface Props {
  inputs: any[]
  stepId: string
  inputValues: Record<string, any>
  running: boolean
}

interface Emits {
  (e: 'run'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <div class="step-inputs">
    <div class="inputs-header">Configuration</div>
    <div class="input-grid">
      <div v-for="input in inputs" :key="input.name" class="input-item-editable">
        <label v-if="input.type === 'boolean'" class="checkbox-label">
          <input type="checkbox" v-model="inputValues[input.name]"
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
          <span class="checkbox-text">
            {{ input.label }}
            <span v-if="input.required" class="text-red-500">*</span>
          </span>
        </label>

        <template v-else>
          <label class="input-label">
            {{ input.label }}
            <span v-if="input.required" class="text-red-500">*</span>
          </label>

          <input v-if="input.type === 'password'" type="password" v-model="inputValues[input.name]"
            :placeholder="input.default" class="input-field">

          <input v-else-if="input.type === 'text'" type="text" v-model="inputValues[input.name]"
            :placeholder="input.default" class="input-field">

          <select v-else-if="input.type === 'select'" v-model="inputValues[input.name]" class="input-field">
            <option v-for="option in input.options" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </template>

        <div v-if="input.description" class="input-description">{{ input.description }}</div>
      </div>
    </div>
    <div class="input-actions">
      <button @click="emit('run')" :disabled="running" class="run-button-small">
        {{ running ? 'Running...' : 'Run with these settings' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.step-inputs {
  padding: 1rem;
  background: var(--bg-secondary, #f9fafb);
}

.dark .step-inputs {
  background: rgba(55, 65, 81, 0.3);
}

.inputs-header {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  color: var(--text-primary, #111827);
}

.dark .inputs-header {
  color: #f3f4f6;
}

.input-grid {
  display: grid;
  gap: 1rem;
}

.input-item-editable {
  display: grid;
  gap: 0.5rem;
}

.input-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  display: block;
}

.dark .input-label {
  color: #f3f4f6;
}

.checkbox-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  display: flex;
  align-items: center;
  cursor: pointer;
}

.dark .checkbox-label {
  color: #f3f4f6;
}

.checkbox-text {
  margin-left: 0.5rem;
}

.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 0.375rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #111827);
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.dark .input-field {
  background: #374151;
  border-color: #4b5563;
  color: #f3f4f6;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-description {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  font-style: italic;
  margin-top: -0.25rem;
}

.input-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.run-button-small {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.run-button-small:hover:not(:disabled) {
  background: #2563eb;
}

.run-button-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
