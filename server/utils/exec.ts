import { execSync } from "node:child_process"

export function exec(command: string, options?: { cwd?: string; timeout?: number }) {
  return execSync(command, {
    cwd: options?.cwd,
    encoding: "utf-8",
    timeout: options?.timeout ?? 5000,
    stdio: ["pipe", "pipe", "ignore"],
  }).trim()
}

export function execSplit(command: string, options?: { cwd?: string; timeout?: number }) {
  return exec(command, options).split("\n").filter(Boolean)
}
