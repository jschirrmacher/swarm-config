<template>
  <div class="login-layout">
    <div class="login-container">
      <div class="login-header">
        <h1>🐳 Swarm Config</h1>
        <p>Repository Management Platform</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input id="username" v-model="credentials.username" type="text" autocomplete="username" required
            :disabled="loading" placeholder="Enter your username" />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" v-model="credentials.password" type="password" autocomplete="current-password" required
            :disabled="loading" placeholder="Enter your password" />
        </div>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>

        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
      </form>

      <div class="login-footer">
        <p>Your password is stored in <code>~/.swarm-config-password</code></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const credentials = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')
const router = useRouter()

async function handleLogin() {
  loading.value = true
  error.value = ''

  try {
    // Authenticate and get JWT token
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${credentials.value.username}:${credentials.value.password}`)
      }
    })

    if (!response.ok) {
      throw new Error('Invalid username or password')
    }

    const { token } = await response.json()

    // Store JWT token in localStorage for subsequent API calls
    localStorage.setItem('swarm-config-token', token)

    // Redirect to main page
    router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 3rem;
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.login-header p {
  color: #666;
  font-size: 0.95rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.form-group input {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.btn {
  padding: 0.875rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert {
  padding: 0.875rem;
  border-radius: 6px;
  font-size: 0.9rem;
}

.alert-error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.login-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
  text-align: center;
}

.login-footer p {
  font-size: 0.85rem;
  color: #666;
}

.login-footer code {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.8rem;
}
</style>
