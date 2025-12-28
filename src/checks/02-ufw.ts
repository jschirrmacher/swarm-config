import { execAsync, commandExists, runCommand, type CheckResult } from "../bootstrap-helpers.ts"

export default async function checkUfw(): Promise<CheckResult> {
  const exists = await commandExists("ufw")
  if (!exists) {
    return {
      name: "UFW Firewall",
      passed: false,
      message: "UFW is not installed",
      fix: async () => {
        console.log("  Installing UFW...")
        await execAsync("sudo apt update && sudo apt install -y ufw")
      },
    }
  }

  try {
    const { stdout } = await runCommand("sudo ufw status")
    const isActive = stdout.includes("Status: active")
    return {
      name: "UFW Firewall",
      passed: isActive,
      message: isActive ? "UFW firewall is active" : "UFW firewall is inactive",
      fix: async () => {
        console.log("  Configuring UFW...")
        await execAsync(
          "sudo ufw allow ssh && sudo ufw allow http && sudo ufw allow https",
        )
        await execAsync("sudo ufw --force enable")
      },
    }
  } catch {
    return {
      name: "UFW Firewall",
      passed: false,
      message: "Cannot check UFW status",
    }
  }
}
