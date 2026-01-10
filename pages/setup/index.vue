<script setup lang="ts">
const { steps, loading, logs, running, fetchSteps, runAllSteps, runStep } = useSetup()

onMounted(() => {
  fetchSteps()
})

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return '✅'
    case 'running': return '⏳'
    case 'failed': return '❌'
    default: return '⭕'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'text-green-600 dark:text-green-400'
    case 'running': return 'text-blue-600 dark:text-blue-400'
    case 'failed': return 'text-red-600 dark:text-red-400'
    default: return 'text-gray-500 dark:text-gray-400'
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto p-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">System Setup</h1>
      <p class="text-gray-600 dark:text-gray-400">
        Manage and monitor system setup steps
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">Setup Steps</h2>
          <button @click="runAllSteps()" :disabled="running || loading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {{ running ? 'Running...' : 'Run All Steps' }}
          </button>
        </div>

        <AppLoading v-if="loading" />

        <div v-else class="space-y-3">
          <div v-for="step in steps" :key="step.id"
            class="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span :class="getStatusColor(step.status)">
                    {{ getStatusIcon(step.status) }}
                  </span>
                  <h3 class="font-semibold">{{ step.name }}</h3>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {{ step.description }}
                </p>
                <div class="flex items-center gap-4 text-xs text-gray-500">
                  <span v-if="step.lastRun">
                    Last run: {{ new Date(step.lastRun).toLocaleString() }}
                  </span>
                  <span v-if="step.isComplete" class="text-green-600 dark:text-green-400">
                    ✓ Complete
                  </span>
                  <span v-if="step.error" class="text-red-600 dark:text-red-400">
                    {{ step.error }}
                  </span>
                </div>
              </div>
              <button @click="runStep(step.id)" :disabled="running"
                class="ml-4 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                Run
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h2 class="text-xl font-semibold mb-4">Live Logs</h2>
        <div class="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-auto"
          style="height: calc(100vh - 300px); min-height: 400px;">
          <div v-if="logs.length === 0" class="text-gray-500">
            No logs yet. Run a setup step to see output.
          </div>
          <div v-else>
            <div v-for="(log, index) in logs" :key="index" class="whitespace-pre-wrap">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
