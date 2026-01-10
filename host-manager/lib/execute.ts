import { spawn } from "child_process"

export interface ExecuteResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
}

export function executeOnHost(command: string): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    const process = spawn(
      "nsenter",
      ["--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "--", "bash", "-c", command],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    )

    let stdout = ""
    let stderr = ""

    process.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
    })

    process.stderr.on("data", (data: Buffer) => {
      stderr += data.toString()
    })

    process.on("close", (exitCode: number | null) => {
      resolve({
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? -1,
      })
    })

    process.on("error", (error: Error) => {
      reject(new Error(`Failed to execute command: ${error.message}`))
    })
  })
}

export async function* executeOnHostStreaming(command: string): AsyncGenerator<string> {
  const process = spawn(
    "nsenter",
    ["--target", "1", "--mount", "--uts", "--ipc", "--net", "--pid", "--", "bash", "-c", command],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  for await (const chunk of process.stdout) {
    yield `data: ${chunk.toString()}\n\n`
  }
  for await (const chunk of process.stderr) {
    yield `data: ${chunk.toString()}\n\n`
  }
}
