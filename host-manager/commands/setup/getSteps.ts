import { defineCommand } from "../../lib/defineCommand.js"
import { setupRegistry } from "./registry.js"
import { setupState } from "../../lib/setupState.js"

/**
 * GET /setup/steps
 * Returns all available setup steps with their current status
 */
export default defineCommand("Get all setup steps with status", "GET", "/setup/steps", async () => {
  await setupState.load()

  const commands = setupRegistry.getAll()
  const steps = await Promise.all(
    commands.map(async command => {
      const state = setupState.getStepState(command.id)
      const isComplete = await command.check().catch(() => false)

      let inputValues: Record<string, any> = {}
      if (command.inputs && command.getInputValues) {
        try {
          inputValues = await command.getInputValues()
        } catch {
          // Ignore errors
        }
      }

      return {
        id: command.id,
        name: command.name,
        description: command.description,
        manualOnly: command.manualOnly,
        inputs: command.inputs?.map(input => ({
          ...input,
          value: inputValues[input.name] ?? input.default,
        })),
        status: state.status,
        lastRun: state.lastRun,
        result: state.result,
        error: state.error,
        isComplete,
      }
    }),
  )

  return { steps }
})
