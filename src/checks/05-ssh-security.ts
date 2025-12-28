import { readFile } from "fs/promises"
import { execAsync, type CheckResult } from "../bootstrap-helpers.ts"

async function checkSshConfig(): Promise<{
  rootLoginDisabled: boolean
  passwordAuthDisabled: boolean
}> {
  try {
    const content = await readFile("/etc/ssh/sshd_config", "utf-8")
    const lines = content.split("\n")

    // Check if PermitRootLogin is explicitly set to 'no'
    const rootLoginDisabled = lines.some(
      line =>
        line.trim().startsWith("PermitRootLogin") &&
        !line.trim().startsWith("#") &&
        line.includes("no"),
    )

    // Check if PasswordAuthentication is explicitly set to 'no'
    const passwordAuthDisabled = lines.some(
      line =>
        line.trim().startsWith("PasswordAuthentication") &&
        !line.trim().startsWith("#") &&
        line.includes("no"),
    )

    return { rootLoginDisabled, passwordAuthDisabled }
  } catch {
    return { rootLoginDisabled: false, passwordAuthDisabled: false }
  }
}

export default async function checkSshSecurity(): Promise<CheckResult> {
  const config = await checkSshConfig()

  const issues: string[] = []
  if (!config.rootLoginDisabled) {
    issues.push("PermitRootLogin not disabled")
  }
  if (!config.passwordAuthDisabled) {
    issues.push("PasswordAuthentication not disabled")
  }

  const passed = issues.length === 0

  return {
    name: "SSH Security Configuration",
    passed,
    message: passed
      ? "SSH security properly configured (root login and password authentication disabled)"
      : issues.join(", "),
    fix: async () => {
      console.log("  Configuring SSH security...")

      // Comment out old settings
      await execAsync(
        "sed -i 's/^PermitRootLogin yes/#PermitRootLogin yes/' /etc/ssh/sshd_config",
      )
      await execAsync(
        "sed -i 's/^PasswordAuthentication yes/#PasswordAuthentication yes/' /etc/ssh/sshd_config",
      )

      // Add new settings at the end
      await execAsync("echo '' >>/etc/ssh/sshd_config")
      await execAsync("echo '# Security settings added by bootstrap' >>/etc/ssh/sshd_config")
      await execAsync("echo 'PasswordAuthentication no' >>/etc/ssh/sshd_config")
      await execAsync("echo 'PermitRootLogin no' >>/etc/ssh/sshd_config")

      // Restart SSH service
      console.log("  Restarting SSH service...")
      await execAsync("service ssh restart")

      console.log("  ✅ SSH security configured")
      console.log("  ⚠️  Make sure you can login with your team user before closing this session!")
    },
  }
}
