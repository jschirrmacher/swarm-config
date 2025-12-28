import { readFile } from "fs/promises"
import { execAsync, runCommand, type CheckResult } from "../bootstrap-helpers.ts"

interface UserInfo {
  username: string
  exists: boolean
  inTeamGroup: boolean
  inDockerGroup: boolean
  hasSudo: boolean
  hasSshDir: boolean
}

async function getUsersFromAuthorizedKeys(): Promise<string[]> {
  try {
    const content = await readFile("/root/.ssh/authorized_keys", "utf-8")
    const users = content
      .split("\n")
      .filter(line => line.trim() && !line.startsWith("#"))
      .map(line => {
        // SSH key format: "type key comment"
        // We want the 3rd value (comment/username)
        const parts = line.trim().split(/\s+/)
        return parts[2] || null
      })
      .filter((username): username is string => username !== null && username.length > 0)
    
    return [...new Set(users)] // Remove duplicates
  } catch (error) {
    return []
  }
}

async function checkUser(username: string): Promise<UserInfo> {
  const info: UserInfo = {
    username,
    exists: false,
    inTeamGroup: false,
    inDockerGroup: false,
    hasSudo: false,
    hasSshDir: false,
  }

  // Check if user exists
  try {
    await execAsync(`id ${username}`)
    info.exists = true
  } catch {
    return info
  }

  // Check group memberships
  try {
    const { stdout } = await runCommand(`groups ${username}`)
    const groups = stdout.toLowerCase()
    info.inTeamGroup = groups.includes("team")
    info.inDockerGroup = groups.includes("docker")
  } catch {
    // User might not exist yet
  }

  // Check sudo access
  try {
    const { stdout } = await runCommand("getent group sudo")
    info.hasSudo = stdout.includes(username)
  } catch {
    // Ignore
  }

  // Check .ssh directory
  try {
    await execAsync(`test -d /home/${username}/.ssh`)
    info.hasSshDir = true
  } catch {
    // Directory doesn't exist
  }

  return info
}

async function createTeamUser(username: string): Promise<void> {
  console.log(`  Creating user: ${username}`)
  
  // Create team group if it doesn't exist
  try {
    await execAsync("getent group team")
  } catch {
    await execAsync("addgroup team")
  }

  // Create user with team group
  try {
    await execAsync(`adduser ${username} --ingroup team --disabled-password --gecos ""`)
  } catch (error) {
    console.log(`  User ${username} already exists, updating...`)
  }

  // Add user to sudo group
  await execAsync(`adduser ${username} sudo`)

  // Add user to docker group
  await execAsync(`adduser ${username} docker`)

  // Create .ssh directory with correct permissions
  await execAsync(`mkdir -m=0700 -p /home/${username}/.ssh`)

  // Copy authorized_keys
  await execAsync(`cp /root/.ssh/authorized_keys /home/${username}/.ssh/`)

  // Set correct ownership
  await execAsync(`chown ${username}:team -R /home/${username}/.ssh`)

  console.log(`  ✅ User ${username} configured successfully`)
}

export default async function checkTeamUsers(): Promise<CheckResult> {
  const usernames = await getUsersFromAuthorizedKeys()

  if (usernames.length === 0) {
    return {
      name: "Team Users",
      passed: true,
      message: "No users found in /root/.ssh/authorized_keys",
    }
  }

  const userInfos = await Promise.all(usernames.map(checkUser))
  const missingUsers = userInfos.filter(info => !info.exists)
  const incompleteUsers = userInfos.filter(
    info =>
      info.exists &&
      (!info.inTeamGroup || !info.inDockerGroup || !info.hasSudo || !info.hasSshDir),
  )

  const allGood = missingUsers.length === 0 && incompleteUsers.length === 0

  const messages: string[] = []
  if (missingUsers.length > 0) {
    messages.push(`Missing users: ${missingUsers.map(u => u.username).join(", ")}`)
  }
  if (incompleteUsers.length > 0) {
    messages.push(`Incomplete setup: ${incompleteUsers.map(u => u.username).join(", ")}`)
  }
  if (allGood) {
    messages.push(
      `All ${usernames.length} team user(s) properly configured: ${usernames.join(", ")}`,
    )
  }

  return {
    name: "Team Users",
    passed: allGood,
    message: messages.join("; "),
    fix: async () => {
      console.log("  Setting up team users...")
      for (const username of usernames) {
        await createTeamUser(username)
      }
    },
  }
}
