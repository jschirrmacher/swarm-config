import { exec } from "child_process"
import { promisify } from "util"

export interface CheckResult {
  name: string
  passed: boolean
  message: string
  fix?: () => Promise<void>
}

export const execAsync = promisify(exec)

export async function runCommand(command: string) {
  try {
    return await execAsync(command)
  } catch (error: unknown) {
    if (error instanceof Error && "stdout" in error && "stderr" in error) {
      return error as { stdout: string; stderr: string }
    }
    throw error
  }
}

export async function commandExists(command: string) {
  try {
    await execAsync(`which ${command}`)
    return true
  } catch {
    return false
  }
}
