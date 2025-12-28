import { commandExists, runCommand, type CheckResult } from "../bootstrap-helpers.ts"

export default async function checkNodeInstallation(): Promise<CheckResult> {
  const exists = await commandExists("node")
  if (!exists) {
    return {
      name: "Node.js Installation",
      passed: false,
      message: "Node.js is not installed (required: current LTS or higher)",
    }
  }

  try {
    const { stdout } = await runCommand("node --version")
    const version = stdout.trim().replace("v", "")
    const majorVersion = parseInt(version.split(".")[0])
    const isValid = majorVersion >= 24

    return {
      name: "Node.js Installation",
      passed: isValid,
      message: isValid
        ? `Node.js ${version} is installed`
        : `Node.js ${version} is too old (required: current LTS v24+ or higher)`,
    }
  } catch {
    return {
      name: "Node.js Installation",
      passed: false,
      message: "Cannot determine Node.js version",
    }
  }
}
