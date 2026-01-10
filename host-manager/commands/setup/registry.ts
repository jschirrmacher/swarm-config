import type { SetupCommand } from "../../lib/defineSetupCommand"
import type { Application, Request, Response } from "express"

/**
 * Registry for all setup commands
 */
export class SetupCommandRegistry {
  private commands: Map<string, SetupCommand> = new Map()

  register(command: SetupCommand): void {
    this.commands.set(command.id, command)
  }

  get(id: string): SetupCommand | undefined {
    return this.commands.get(id)
  }

  getAll(): SetupCommand[] {
    return Array.from(this.commands.values()).sort((a, b) => a.id.localeCompare(b.id))
  }

  getAllIds(): string[] {
    return this.getAll().map(cmd => cmd.id)
  }

  registerAll(
    app: Application,
    authenticate: (req: Request, res: Response, next: () => void) => void,
  ): void {
    for (const command of this.commands.values()) {
      command.register(app, authenticate)
    }
  }
}

// Singleton instance
export const setupRegistry = new SetupCommandRegistry()
