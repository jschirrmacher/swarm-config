export interface Step {
  title: string
  logs: string[]
  status: "pending" | "running" | "completed" | "failed"
  expanded: boolean
  id?: string
}

interface StepDefinition {
  id: string
  title: string
  filename: string
}

export function useSystemUpdate() {
  const steps = ref<Step[]>([])
  const currentStepIndex = ref(-1)
  const hasMatchedStepPattern = ref(false)
  const stepDefinitions = ref<StepDefinition[]>([])

  async function loadStepDefinitions() {
    try {
      stepDefinitions.value = await $fetch("/api/system/steps")
    } catch (error) {
      console.error("Failed to load step definitions:", error)
      // Fallback to empty array
      stepDefinitions.value = []
    }
  }

  function initializeSteps() {
    steps.value = stepDefinitions.value.map(def => ({
      id: def.id,
      title: def.title,
      logs: [],
      status: "pending",
      expanded: false,
    }))
    currentStepIndex.value = -1
    hasMatchedStepPattern.value = false
  }

  function toggleStep(index: number) {
    const step = steps.value[index]
    if (step && step.status !== "running") {
      step.expanded = !step.expanded
    }
  }

  function addLogToStep(message: string) {
    // Check for machine-readable step markers
    const stepStartMatch = message.match(/\[STEP:START:(.+?)\]/)
    const stepCompleteMatch = message.match(/\[STEP:COMPLETE:(.+?)\]/)

    if (stepStartMatch) {
      const stepName = stepStartMatch[1]

      if (!stepName) return

      // Find matching step by ID
      const stepIndex = steps.value.findIndex(s => s.id === stepName)

      if (stepIndex >= 0) {
        // Mark that we've matched a real step pattern
        hasMatchedStepPattern.value = true

        // Mark previous step as completed and collapse it
        if (currentStepIndex.value >= 0 && currentStepIndex.value !== stepIndex) {
          const prevStep = steps.value[currentStepIndex.value]
          if (prevStep && prevStep.status === "running") {
            prevStep.status = "completed"
            prevStep.expanded = false
          }
        }

        // Start new step and expand it
        currentStepIndex.value = stepIndex
        const currentStep = steps.value[stepIndex]
        if (currentStep) {
          currentStep.status = "running"
          currentStep.expanded = true
        }
      }
      // Don't add the marker itself to logs
      return
    }

    if (stepCompleteMatch) {
      // Mark current step as completed
      if (currentStepIndex.value >= 0) {
        const currentStep = steps.value[currentStepIndex.value]
        if (currentStep) {
          currentStep.status = "completed"
          currentStep.expanded = false
        }
      }
      // Don't add the marker itself to logs
      return
    }

    // Add log to current step
    if (currentStepIndex.value >= 0) {
      steps.value[currentStepIndex.value]?.logs.push(message)
    } else {
      // Before first step - add to first pending step
      const firstStep = steps.value[0]
      if (firstStep) {
        firstStep.logs.push(message)
        if (!firstStep.expanded && firstStep.status === "pending") {
          firstStep.status = "running"
          firstStep.expanded = true
          currentStepIndex.value = 0
        }
      }
    }
  }

  function markCurrentStepCompleted() {
    if (currentStepIndex.value >= 0) {
      const currentStep = steps.value[currentStepIndex.value]
      if (currentStep) {
        currentStep.status = "completed"
        currentStep.expanded = false
      }
    }
  }

  function markCurrentStepStatus(status: "completed" | "failed") {
    if (currentStepIndex.value >= 0) {
      const currentStep = steps.value[currentStepIndex.value]
      if (currentStep) {
        currentStep.status = status
      }
    }
  }

  return {
    steps,
    currentStepIndex,
    hasMatchedStepPattern,
    loadStepDefinitions,
    initializeSteps,
    toggleStep,
    addLogToStep,
    markCurrentStepCompleted,
    markCurrentStepStatus,
  }
}
