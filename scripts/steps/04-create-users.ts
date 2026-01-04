#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { runStep } from "../lib/step.js"
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, chownSync } from "fs"

await runStep("04-create-users", "Creating team users from SSH authorized_keys...", async () => {
  const authorizedKeysPath = "/root/.ssh/authorized_keys"

  if (!existsSync(authorizedKeysPath)) {
    console.log("⚠️  /root/.ssh/authorized_keys not found, skipping team user creation")
    return
  }

  // Extract and normalize usernames from SSH keys
  const authorizedKeys = readFileSync(authorizedKeysPath, "utf-8")
  const lines = authorizedKeys.split("\n").filter(line => line.trim() && !line.startsWith("#"))

  const rawUsernames = lines
    .map(line => {
      const parts = line.split(/\s+/)
      return parts[2] || ""
    })
    .filter(Boolean)

  const uniqueUsernames = new Set<string>()

  for (const rawUser of rawUsernames) {
    // Normalize: remove non-alphanumeric (except underscore), lowercase
    const normalized = rawUser.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()

    if (normalized && /^[a-z]/.test(normalized)) {
      uniqueUsernames.add(normalized)
    } else {
      console.log(`  ⚠️  Skipping invalid username: ${rawUser}`)
    }
  }

  const usernames = Array.from(uniqueUsernames)

  if (usernames.length === 0) {
    console.log("⚠️  No valid usernames found")
    return
  }

  // Create team group
  try {
    exec("getent group team")
  } catch {
    exec("addgroup team")
    console.log("  Created 'team' group")
  }

  // Configure passwordless sudo
  writeFileSync("/etc/sudoers.d/team", "%team ALL=(ALL:ALL) NOPASSWD:ALL\n")
  chmodSync("/etc/sudoers.d/team", 0o440)
  console.log("  ✅ Passwordless sudo configured")

  // Create each user
  for (const username of usernames) {
    console.log(`  Setting up user: ${username}`)

    // Create user
    try {
      exec(`id ${username}`)
    } catch {
      exec(`adduser ${username} --ingroup team --disabled-password --gecos ""`)
    }

    // Add to groups
    exec(`usermod -aG sudo ${username}`)
    exec(`usermod -aG docker ${username}`)

    // Setup SSH
    const sshDir = `/home/${username}/.ssh`
    if (!existsSync(sshDir)) {
      mkdirSync(sshDir, { recursive: true })
    }
    chmodSync(sshDir, 0o700)

    // Copy only this user's SSH key from root's authorized_keys
    const userKeys =
      lines
        .filter(
          line =>
            line.toLowerCase().includes(`@${username}`) ||
            line.toLowerCase().includes(` ${username}@`) ||
            line.toLowerCase().endsWith(` ${username}`),
        )
        .join("\n") + "\n"

    const authorizedKeysFile = `${sshDir}/authorized_keys`
    writeFileSync(authorizedKeysFile, userKeys)
    chmodSync(authorizedKeysFile, 0o600)
    exec(`chown -R ${username}:team ${sshDir}`)

    // Generate password for Web UI
    const password = (exec("openssl rand -base64 32", { encoding: "utf-8" }) as string)
      .replace(/[=+/]/g, "")
      .substring(0, 32)

    // Save password to user's home
    const domain = process.env.DOMAIN || "your-domain.com"
    const passwordFile = `/home/${username}/.swarm-config-password`
    const passwordContent = `# Swarm Config Web UI Password
# Generated on: ${new Date().toISOString()}
# Access the Web UI at: https://config.${domain}

Username: ${username}
Password: ${password}

# This password is for accessing:
# - Web UI: https://config.${domain}
# - All services protected with basic-auth

# Keep this file secure!
`
    writeFileSync(passwordFile, passwordContent)
    chmodSync(passwordFile, 0o400)
    exec(`chown ${username}:team ${passwordFile}`)

    console.log(`  ✅ User ${username} configured`)
    console.log(`     Password saved to /home/${username}/.swarm-config-password`)
  }

  console.log(`✅ Team users created: ${usernames.join(" ")}`)
  console.log("📋 Passwords saved to each user's home directory in .swarm-config-password")

  // Export for SSH security step
  process.env.USERNAMES = usernames.join(" ")
})
