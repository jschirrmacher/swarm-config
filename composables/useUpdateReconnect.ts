export function useUpdateReconnect() {
  const reconnecting = ref(false)
  let reconnectAttempts = 0

  const maxReconnectAttempts = 20
  const reconnectDelay = 5000 // 5 seconds
  const initialReconnectDelay = 10000 // 10 seconds for first attempt

  async function checkUpdateStatus() {
    try {
      const response = await fetch("/api/debug")
      return response.ok
    } catch {
      return false
    }
  }

  function attemptReconnect(
    token: string,
    options: {
      onLog: (message: string) => void
      onSuccess: () => void
      onError: (message: string) => void
      hasMatchedStepPattern: boolean
    },
  ) {
    if (reconnectAttempts >= maxReconnectAttempts) {
      reconnecting.value = false
      options.onError("Could not reconnect after service restart")
      return
    }

    reconnectAttempts++
    reconnecting.value = true

    // Use longer delay for first attempt to give services time to restart
    const delay = reconnectAttempts === 1 ? initialReconnectDelay : reconnectDelay
    options.onLog(
      `[Reconnecting in ${delay / 1000}s... Attempt ${reconnectAttempts}/${maxReconnectAttempts}]`,
    )

    setTimeout(async () => {
      const serverUp = await checkUpdateStatus()
      if (serverUp) {
        // Check if any real step patterns were matched (not just reconnect messages)
        if (options.hasMatchedStepPattern) {
          // Update actually ran and service restarted
          options.onLog("[Service is back online]")
          options.onLog("[Update completed - service restarted successfully]")
          reconnecting.value = false
          reconnectAttempts = 0
          options.onSuccess()
        } else {
          // Server is up but no real steps ran - this was an error from the start
          reconnecting.value = false
          reconnectAttempts = 0
          options.onError("Update service not available or did not start")
        }
      } else {
        // Try again
        attemptReconnect(token, options)
      }
    }, delay)
  }

  function resetReconnectAttempts() {
    reconnectAttempts = 0
    reconnecting.value = false
  }

  return {
    reconnecting,
    attemptReconnect,
    resetReconnectAttempts,
  }
}
