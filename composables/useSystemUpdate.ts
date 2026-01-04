export interface Step {
  title: string
  logs: string[]
  status: "pending" | "running" | "completed" | "failed"
  expanded: boolean
}

interface SetupStep {
  pattern: RegExp
  title: string
}

const setupSteps: SetupStep[] = [
  { pattern: /01-get-domain|Getting domain/i, title: "Get Domain Configuration" },
  { pattern: /02-install-docker|Installing Docker|docker/i, title: "Install Docker" },
  { pattern: /03-install-firewall|firewall|ufw/i, title: "Configure Firewall" },
  { pattern: /04-create-users|Creating users/i, title: "Create Users" },
  { pattern: /05-configure-ssh|SSH|authorized_keys/i, title: "Configure SSH" },
  { pattern: /06-create-network|Creating network|docker network/i, title: "Create Docker Network" },
  { pattern: /06\.5-setup-host-manager|host-manager.*token/i, title: "Setup Host Manager Token" },
  { pattern: /07-deploy-kong|Deploying Kong|kong/i, title: "Deploy Kong Gateway" },
  { pattern: /08-deploy-webui|Deploying.*UI|Building.*ui/i, title: "Deploy Web UI" },
  { pattern: /09-install-glusterfs|glusterfs/i, title: "Install GlusterFS" },
  { pattern: /10-prepare-apps|Preparing apps/i, title: "Prepare Apps Directory" },
]

export function useSystemUpdate() {
  const steps = ref<Step[]>([])
  const currentStepIndex = ref(-1)
  const hasMatchedStepPattern = ref(false)

  function initializeSteps() {
    steps.value = setupSteps.map(step => ({
      title: step.title,
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
    // Check if this is a new step
    for (let i = 0; i < setupSteps.length; i++) {
      if (setupSteps[i]?.pattern.test(message) && currentStepIndex.value < i) {
        // Mark that we've matched a real step pattern
        hasMatchedStepPattern.value = true

        // Mark previous step as completed and collapse it
        if (currentStepIndex.value >= 0) {
          const prevStep = steps.value[currentStepIndex.value]
          if (prevStep) {
            prevStep.status = "completed"
            prevStep.expanded = false
          }
        }
        // Start new step and expand it
        currentStepIndex.value = i
        const currentStep = steps.value[i]
        if (currentStep) {
          currentStep.status = "running"
          currentStep.expanded = true
        }
        break
      }
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
    initializeSteps,
    toggleStep,
    addLogToStep,
    markCurrentStepCompleted,
    markCurrentStepStatus,
  }
}
