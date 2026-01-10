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

      return {
        id: command.id,
        name: command.name,
        description: command.description,
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
