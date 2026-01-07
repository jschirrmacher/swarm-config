<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

// Inject auth utilities from layout
const getAuthHeaders = inject<() => HeadersInit>('getAuthHeaders', () => ({}))

// Form data
const smtpConfig = ref({
  host: '',
  port: '587',
  user: '',
  password: '',
  from: '',
  tls: true
})

const isConfigured = ref(false)

// Load current SMTP configuration
onMounted(async () => {
  loading.value = true
  try {
    const data = await $fetch('/api/system/smtp', {
      headers: getAuthHeaders()
    })
    if (data.configured) {
      isConfigured.value = true
      smtpConfig.value = {
        host: (data as any).host || '',
        port: (data as any).port || '587',
        user: (data as any).user || '',
        password: '', // Never send password to frontend
        from: (data as any).from || '',
        tls: (data as any).tls !== false
      }
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load SMTP configuration'
  } finally {
    loading.value = false
  }
})

async function saveConfig() {
  if (saving.value) return

  // Validate required fields
  if (!smtpConfig.value.host || !smtpConfig.value.user) {
    error.value = 'SMTP Host and User are required'
    return
  }

  // Password is required if not already configured
  if (!isConfigured.value && !smtpConfig.value.password) {
    error.value = 'Password is required for initial configuration'
    return
  }

  saving.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch('/api/system/smtp', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: smtpConfig.value
    })

    success.value = 'SMTP configuration saved successfully'
    isConfigured.value = true

    // Clear password field after successful save
    smtpConfig.value.password = ''
  } catch (e: any) {
    error.value = e.message || 'Failed to save SMTP configuration'
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

    <div class="page-header">
      <h1>SMTP Configuration</h1>
      <p class="subtitle">Configure SMTP settings to enable email notifications from the system.</p>
    </div>

    <div class="config-section">
      <AppAlert v-if="error" type="error" :message="error" />
      <AppAlert v-if="success" type="success" :message="success" />
      <AppAlert v-if="isConfigured && !success && !error" type="info"
        message="Email is already configured. Update the settings below to reconfigure." />

      <AppLoading v-if="loading" message="Loading SMTP configuration..." />

      <form v-else @submit.prevent="saveConfig" class="smtp-form">
        <div class="form-group">
          <label for="host" class="form-label">
            SMTP Host <span class="required">*</span>
          </label>
          <input id="host" v-model="smtpConfig.host" type="text" required placeholder="smtp.gmail.com"
            class="form-input" />
        </div>

        <div class="form-group">
          <label for="port" class="form-label">
            SMTP Port <span class="required">*</span>
          </label>
          <input id="port" v-model="smtpConfig.port" type="number" required placeholder="587" class="form-input" />
          <p class="form-hint">Use 587 for TLS, 465 for SSL</p>
        </div>

        <div class="form-group">
          <label for="user" class="form-label">
            SMTP Username/Email <span class="required">*</span>
          </label>
          <input id="user" v-model="smtpConfig.user" type="text" required placeholder="your@email.com"
            class="form-input" />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">
            SMTP Password <span v-if="!isConfigured" class="required">*</span>
          </label>
          <input id="password" v-model="smtpConfig.password" type="password" :required="!isConfigured"
            placeholder="••••••••" class="form-input" />
          <p v-if="isConfigured" class="form-hint">
            Leave empty to keep existing password
          </p>
        </div>

        <div class="form-group">
          <label for="from" class="form-label">
            From Address
          </label>
          <input id="from" v-model="smtpConfig.from" type="email" placeholder="noreply@example.com"
            class="form-input" />
          <p class="form-hint">
            Optional. Defaults to SMTP username if not specified.
          </p>
        </div>

        <div class="form-checkbox">
          <input id="tls" v-model="smtpConfig.tls" type="checkbox" class="checkbox-input" />
          <label for="tls" class="checkbox-label">
            Use TLS
          </label>
        </div>

        <div class="form-actions">
          <button type="submit" :disabled="saving" class="btn btn-primary">
            {{ saving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
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

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
  font-size: 2rem;
  color: var(--accent);
}

.subtitle {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
  font-size: 1rem;
}

.config-section {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.smtp-form {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

.required {
  color: #ef4444;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.form-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.checkbox-input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: var(--accent);
}

.checkbox-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
}

.form-actions {
  margin-top: 0.5rem;
}

.btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .smtp-form {
    padding: 1.5rem;
  }
}
</style>
