export const useSetup = () => {
  const steps = ref<any[]>([])
  const loading = ref(false)
  const logs = ref<string[]>([])
  const running = ref(false)

  const fetchSteps = async () => {
    loading.value = true
    try {
      const { authFetch } = useAuthFetch()
      const response = await authFetch("/api/setup/steps")
      const data = await response.json()
      steps.value = data.steps
    } catch (error) {
      console.error("Failed to fetch setup steps:", error)
    } finally {
      loading.value = false
    }
  }

  const runAllSteps = async (force = false) => {
    running.value = true
    logs.value = []

    try {
      const response = await fetch("/api/setup/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      })

      if (!response.ok || !response.body) {
        throw new Error("Failed to start setup")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6))

            if (data.event === "log" && data.data?.message) {
              logs.value.push(data.data.message)
            } else if (data.event === "step-start" && data.data?.name) {
              logs.value.push(`\n🚀 ${data.data.name}`)
            } else if (data.event === "step-complete" && data.data?.step) {
              logs.value.push(`✅ ${data.data.step} completed`)
            } else if (data.event === "step-skip" && data.data?.step) {
              logs.value.push(`⏭️  ${data.data.step} skipped`)
            } else if (data.event === "step-error" && data.data?.error) {
              logs.value.push(`❌ Error: ${data.data.error}`)
            } else if (data.event === "complete") {
              logs.value.push(`\n✅ Setup complete!`)
            }
          }
        }
      }

      await fetchSteps()
    } catch (error) {
      console.error("Setup failed:", error)
      logs.value.push(`\n❌ Setup failed: ${error}`)
    } finally {
      running.value = false
    }
  }

  const runStep = async (stepId: string, force = false) => {
    running.value = true
    logs.value = []

    try {
      const { authFetch } = useAuthFetch()
      const response = await authFetch(`/api/setup/step/${stepId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      })

      const data = await response.json()

      if (data.skipped) {
        logs.value.push(`⏭️  ${stepId} already completed`)
      } else if (data.success) {
        logs.value.push(`✅ ${stepId} completed successfully`)
      }

      await fetchSteps()
    } catch (error) {
      console.error("Step failed:", error)
      logs.value.push(`❌ ${stepId} failed: ${error}`)
    } finally {
      running.value = false
    }
  }

  return {
    steps,
    loading,
    logs,
    running,
    fetchSteps,
    runAllSteps,
    runStep,
  }
}
