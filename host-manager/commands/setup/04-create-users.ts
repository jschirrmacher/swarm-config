import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

/**
 * Create team users from SSH authorized_keys
 * Extracts usernames from SSH keys and creates system users with proper permissions
 */
export default defineSetupCommand({
  id: "04-create-users",
  name: "Create Team Users",
  description: "Create team users from SSH authorized_keys with sudo and docker access",

  async check() {
    try {
      const result = await executeOnHost("getent group team")
      return result.exitCode === 0
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Checking for SSH authorized_keys..."

    const keysCheck = await executeOnHost(
      "test -f /root/.ssh/authorized_keys && echo exists || echo missing",
    )
    if (keysCheck.stdout.trim() === "missing") {
      yield "⚠️  /root/.ssh/authorized_keys not found, skipping team user creation"
      return { success: true }
    }

    yield "Reading authorized_keys..."
    const keysContent = await executeOnHost("cat /root/.ssh/authorized_keys")
    const lines = keysContent.stdout
      .split("\n")
      .filter(line => line.trim() && !line.startsWith("#"))

    // Extract usernames
    const rawUsernames = lines
      .map(line => {
        const parts = line.split(/\s+/)
        return parts[2] || ""
      })
      .filter(Boolean)

    const uniqueUsernames = new Set<string>()
    for (const rawUser of rawUsernames) {
      const normalized = rawUser.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
      if (normalized && /^[a-z]/.test(normalized)) {
        uniqueUsernames.add(normalized)
      } else {
        yield `  ⚠️  Skipping invalid username: ${rawUser}`
      }
    }

    const usernames = Array.from(uniqueUsernames)
    if (usernames.length === 0) {
      yield "⚠️  No valid usernames found"
      return { success: true }
    }

    yield `Found ${usernames.length} user(s): ${usernames.join(", ")}`

    // Create team group
    yield "Creating 'team' group..."
    const groupCheck = await executeOnHost("getent group team || addgroup team")
    if (groupCheck.stdout.includes("addgroup")) {
      yield "  Created 'team' group"
    }

    // Configure passwordless sudo
    yield "Configuring passwordless sudo..."
    await executeOnHost('echo "%team ALL=(ALL:ALL) NOPASSWD:ALL" > /etc/sudoers.d/team')
    await executeOnHost("chmod 440 /etc/sudoers.d/team")
    yield "  ✅ Passwordless sudo configured"

    // Create each user
    for (const username of usernames) {
      yield `Setting up user: ${username}`

      // Create user if not exists
      const userCheck = await executeOnHost(
        `id ${username} 2>/dev/null || adduser ${username} --ingroup team --disabled-password --gecos ""`,
      )

      // Add to groups
      await executeOnHost(`usermod -aG sudo ${username}`)
      await executeOnHost(`usermod -aG docker ${username}`)

      // Setup SSH directory
      await executeOnHost(`mkdir -p /home/${username}/.ssh`)
      await executeOnHost(`chmod 700 /home/${username}/.ssh`)

      // Copy user's SSH keys
      const userKeysScript = `
        grep -i "@${username}\\|${username}@\\|${username}$" /root/.ssh/authorized_keys > /home/${username}/.ssh/authorized_keys || touch /home/${username}/.ssh/authorized_keys
        chmod 600 /home/${username}/.ssh/authorized_keys
        chown -R ${username}:team /home/${username}/.ssh
      `
      await executeOnHost(userKeysScript)

      yield `  ✅ User ${username} configured with SSH key authentication`
    }

    yield `✅ Team users created: ${usernames.join(" ")}`
    yield "🔑 Users can now log in via SSH key authentication"

    return { success: true }
  },
})
