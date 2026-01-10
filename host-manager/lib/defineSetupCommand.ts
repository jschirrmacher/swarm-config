import type { Application, Request, Response } from "express"

export interface SetupCommandConfig {
  id: string
  name: string
  description: string
  check: () => Promise<boolean>
  execute: () => AsyncGenerator<string, { success: boolean; error?: string }, unknown>
}

export interface SetupCommand extends SetupCommandConfig {
  register: (
    app: Application,
    authenticate: (req: Request, res: Response, next: () => void) => void,
  ) => void
}

/**
 * Defines a setup command that can be executed individually or as part of a setup sequence.
 * Setup commands are idempotent and check their state before executing.
 */
export function defineSetupCommand(config: SetupCommandConfig): SetupCommand {
  return {
    ...config,
    register: (app, authenticate) => {
      // Individual step execution endpoint
      app.post(`/setup/step/${config.id}`, authenticate, async (req: Request, res: Response) => {
        try {
          const force = req.body?.force === true

          // Check if already completed (unless forced)
          if (!force) {
            const isComplete = await config.check()
            if (isComplete) {
              res.json({
                success: true,
                skipped: true,
                message: "Step already completed",
              })
              return
            }
          }

          // Execute the step
          res.setHeader("Content-Type", "text/event-stream")
          res.setHeader("Cache-Control", "no-cache")
          res.setHeader("Connection", "keep-alive")

          for await (const message of config.execute()) {
            res.write(`data: ${JSON.stringify({ type: "log", message })}\n\n`)
          }

          res.write(`data: ${JSON.stringify({ type: "complete", success: true })}\n\n`)
          res.end()
        } catch (error) {
          res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    },
  }
}
