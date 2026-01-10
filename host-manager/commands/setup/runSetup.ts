import { defineStreamingCommand } from "../../lib/defineCommand.js"
import { setupRegistry } from "./registry.js"
import { setupState } from "../../lib/setupState.js"
import type { Request } from "express"

/**
 * POST /setup/run
 * Runs all or selected setup steps in sequence
 */
export default defineStreamingCommand(
  "Run setup steps in sequence",
  "POST",
  "/setup/run",
  async function* (req: Request) {
    await setupState.load()

    const requestedSteps = req.body?.steps as string[] | undefined
    const force = req.body?.force === true

    const commands = requestedSteps
      ? requestedSteps.map(id => setupRegistry.get(id)).filter(cmd => cmd !== undefined)
      : setupRegistry.getAll()

    let succeeded = 0
    let failed = 0
    let skipped = 0

    for (const command of commands) {
      yield JSON.stringify({
        event: "step-start",
        data: { step: command.id, name: command.name },
      })

      try {
        // Check if already completed (unless forced)
        if (!force) {
          const isComplete = await command.check()
          if (isComplete) {
            yield JSON.stringify({
              event: "step-skip",
              data: { step: command.id, message: "Already completed" },
            })
            skipped++
            continue
          }
        }

        // Start step
        await setupState.startStep(command.id)

        // Execute step
        for await (const message of command.execute()) {
          yield JSON.stringify({
            event: "log",
            data: { step: command.id, message },
          })
          await setupState.addLog(command.id, message)
        }

        // Complete step
        await setupState.completeStep(command.id, true)
        yield JSON.stringify({
          event: "step-complete",
          data: { step: command.id, status: "success" },
        })
        succeeded++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await setupState.completeStep(command.id, false, errorMessage)
        yield JSON.stringify({
          event: "step-error",
          data: { step: command.id, error: errorMessage },
        })
        failed++

        // Stop on first error
        break
      }
    }

    yield JSON.stringify({
      event: "complete",
      data: { total: commands.length, succeeded, failed, skipped },
    })
  },
)
