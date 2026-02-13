<template>
  <div class="login-layout">
    <div class="login-container">
      <div class="login-header">
        <h1>🐳 Swarm Config</h1>
        <p>Repository Management Platform</p>
      </div>

      <!-- Step 1: Username -->
      <form v-if="step === 'username'" @submit.prevent="requestChallenge" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input id="username" v-model="credentials.username" type="text" autocomplete="username" required
            :disabled="loading" placeholder="Enter your username" />
        </div>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? "Requesting challenge..." : "Continue" }}
        </button>

        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
      </form>

      <!-- Step 2: Challenge & Signature -->
      <div v-else-if="step === 'challenge'" class="login-form">
        <div class="challenge-section">
          <h3>Sign with your SSH Key</h3>

          <div class="form-group">
            <label for="os-select">Select Operating System</label>
            <select id="os-select" v-model="selectedOS">
              <option value="macos">macOS (copies to clipboard)</option>
              <option value="linux-xclip">Linux with xclip (copies to clipboard)</option>
              <option value="linux-xsel">Linux with xsel (copies to clipboard)</option>
              <option value="windows">Windows/Git Bash (copies to clipboard)</option>
              <option value="manual">Manual (no clipboard)</option>
            </select>
          </div>

          <p class="instruction">Run this command in your terminal:</p>

          <div class="code-block">
            <code>{{ currentCommand }}</code>
            <button type="button" class="btn-copy" @click="copyToClipboard(currentCommand)" title="Copy command">
              📋
            </button>
          </div>

          <p class="instruction">Then paste the signature below:</p>

          <div class="form-group">
            <label for="signature">SSH Signature</label>
            <textarea id="signature" v-model="signature" rows="8"
              placeholder="Paste the signature here (-----BEGIN SSH SIGNATURE-----...)" :disabled="loading"
              required></textarea>
          </div>

          <button type="button" class="btn btn-primary" @click="verifySignature" :disabled="loading || !signature">
            {{ loading ? "Verifying..." : "Verify & Sign In" }}
          </button>

          <button type="button" class="btn btn-secondary" @click="reset()" :disabled="loading">
            Cancel
          </button>

          <div v-if="error" class="alert alert-error">
            {{ error }}
          </div>
        </div>
      </div>

      <div class="login-footer">
        <p>
          Authenticate using your SSH private key (<code>~/.ssh/id_rsa</code>)
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const credentials = ref({
  username: "",
})

const step = ref<"username" | "challenge">("username")
const challenge = ref("")
const signCommand = ref("")
const signature = ref("")
const loading = ref(false)
const error = ref("")
const router = useRouter()

// Detect OS from browser
function detectOS(): "macos" | "linux-xclip" | "linux-xsel" | "windows" | "manual" {
  if (process.client) {
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()

    if (platform.includes('mac') || userAgent.includes('mac')) {
      return 'macos'
    }
    if (platform.includes('win') || userAgent.includes('win')) {
      return 'windows'
    }
    if (platform.includes('linux') || userAgent.includes('linux')) {
      // Default to xclip for Linux
      return 'linux-xclip'
    }
  }
  return 'manual'
}

const selectedOS = ref<"macos" | "linux-xclip" | "linux-xsel" | "windows" | "manual">(detectOS())

const osCommands = computed(() => {
  const base = `echo -n '${challenge.value}' | ssh-keygen -Y sign -f ~/.ssh/id_rsa -n login`
  return {
    macos: `${base} | pbcopy`,
    "linux-xclip": `${base} | xclip -selection clipboard`,
    "linux-xsel": `${base} | xsel --clipboard`,
    windows: `${base} | clip`,
    manual: base,
  }
})

const currentCommand = computed(() => osCommands.value[selectedOS.value])

async function requestChallenge() {
  if (!credentials.value.username) {
    error.value = "Username is required"
    return
  }

  loading.value = true
  error.value = ""

  try {
    const response = await fetch("/api/auth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: credentials.value.username }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || "Failed to get challenge")
    }

    const data = await response.json()
    challenge.value = data.challenge

    step.value = "challenge"
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to get challenge"
  } finally {
    loading.value = false
  }
}

async function verifySignature() {
  loading.value = true
  error.value = ""

  try {
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: credentials.value.username,
        signature: signature.value,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || "Authentication failed")
    }

    const { token } = await response.json()

    // Store JWT token in localStorage
    localStorage.setItem("swarm-config-token", token)

    // Redirect to main page
    router.push("/")
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Authentication failed"
  } finally {
    loading.value = false
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function reset() {
  step.value = "username"
  challenge.value = ""
  signCommand.value = ""
  signature.value = ""
  error.value = ""
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
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 20px 60px var(--shadow);
  padding: 3rem;
  width: 100%;
  max-width: 600px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.login-header p {
  color: var(--text-secondary);
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
  font-weight: normal;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-group input {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group input:disabled {
  background: var(--bg-primary);
  cursor: not-allowed;
  opacity: 0.6;
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
  background: var(--accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
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
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.login-footer p {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.os-selector {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.form-group select {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s;
  cursor: pointer;
}

.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group select:disabled {
  background: var(--bg-primary);
  cursor: not-allowed;
  opacity: 0.6;
}

.login-footer code {
  background: var(--bg-primary);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.divider {
  text-align: center;
  color: #999;
  font-size: 0.9rem;
  position: relative;
  margin: 0.5rem 0;
}

.divider::before,
.divider::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #e0e0e0;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--border-color);
}

.challenge-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.challenge-section h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.2rem;
}

.instruction {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

.code-block {
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  padding: 1rem;
  position: relative;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.85rem;
  word-break: break-all;
  color: #e2e8f0;
  line-height: 1.6;
}

.btn-copy {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 1rem;
}

.btn-copy:hover {
  background: var(--bg-primary);
}

.form-group textarea {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: monospace;
  background: var(--bg-secondary);
  color: var(--text-primary);
  resize: vertical;
  transition: border-color 0.2s;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group textarea:disabled {
  background: var(--bg-primary);
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
