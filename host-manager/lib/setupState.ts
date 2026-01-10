import { promises as fs } from "fs"
import { dirname, join } from "path"

const STATE_FILE = "/var/lib/host-manager/setup-state.json"
const LOGS_DIR = "/var/lib/host-manager/logs"

export interface SetupStepState {
  status: "pending" | "running" | "completed" | "failed"
  lastRun: string | null
  result: "success" | "error" | null
  error?: string
  logs: string[]
}

export interface SetupState {
  steps: Record<string, SetupStepState>
}

/**
 * Manages the state of setup steps
 */
export class SetupStateManager {
  private state: SetupState = { steps: {} }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(STATE_FILE, "utf-8")
      this.state = JSON.parse(content)

      // Load logs from disk for each step
      for (const stepId of Object.keys(this.state.steps)) {
        const logs = await this.loadLogsFromDisk(stepId)
        this.state.steps[stepId].logs = logs
      }
    } catch (error) {
      // File doesn't exist yet, use empty state
      this.state = { steps: {} }
    }
  }

  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(STATE_FILE), { recursive: true })
      await fs.writeFile(STATE_FILE, JSON.stringify(this.state, null, 2), "utf-8")
    } catch (error) {
      console.error("Failed to save setup state:", error)
    }
  }

  getStepState(stepId: string): SetupStepState {
    return (
      this.state.steps[stepId] || {
        status: "pending",
        lastRun: null,
        result: null,
        logs: [],
      }
    )
  }

  async updateStepState(stepId: string, updates: Partial<SetupStepState>): Promise<void> {
    this.state.steps[stepId] = {
      ...this.getStepState(stepId),
      ...updates,
    }
    await this.save()
  }

  async startStep(stepId: string): Promise<void> {
    // Clear log file when starting step (overwrite, don't append)
    await this.clearLogFile(stepId)

    await this.updateStepState(stepId, {
      status: "running",
      lastRun: new Date().toISOString(),
      logs: [],
    })
  }

  async completeStep(stepId: string, success: boolean, error?: string): Promise<void> {
    await this.updateStepState(stepId, {
      status: success ? "completed" : "failed",
      result: success ? "success" : "error",
      error,
    })
  }

  async addLog(stepId: string, message: string): Promise<void> {
    const state = this.getStepState(stepId)
    state.logs.push(message)
    await this.updateStepState(stepId, { logs: state.logs })

    // Also write to disk
    await this.appendLogToDisk(stepId, message)
  }

  getAllSteps(): Record<string, SetupStepState> {
    return this.state.steps
  }

  private getLogFilePath(stepId: string): string {
    return join(LOGS_DIR, `${stepId}.log`)
  }

  private async loadLogsFromDisk(stepId: string): Promise<string[]> {
    try {
      const logFile = this.getLogFilePath(stepId)
      const content = await fs.readFile(logFile, "utf-8")
      return content.split("\n").filter(line => line.trim() !== "")
    } catch {
      // Log file doesn't exist or can't be read
      return []
    }
  }

  private async clearLogFile(stepId: string): Promise<void> {
    try {
      await fs.mkdir(LOGS_DIR, { recursive: true })
      const logFile = this.getLogFilePath(stepId)
      await fs.writeFile(logFile, "", "utf-8")
    } catch (error) {
      console.error(`Failed to clear log file for ${stepId}:`, error)
    }
  }

  private async appendLogToDisk(stepId: string, message: string): Promise<void> {
    try {
      await fs.mkdir(LOGS_DIR, { recursive: true })
      const logFile = this.getLogFilePath(stepId)
      await fs.appendFile(logFile, message + "\n", "utf-8")
    } catch (error) {
      console.error(`Failed to append log for ${stepId}:`, error)
    }
  }
}

// Singleton instance
export const setupState = new SetupStateManager()
