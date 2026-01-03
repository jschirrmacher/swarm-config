#!/usr/bin/env tsx
import { execSync } from "child_process"
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  chmodSync,
  existsSync,
  mkdirSync,
  copyFileSync,
} from "fs"
import { join, dirname, resolve } from "path"
import { createInterface } from "readline"

console.log("🔄 Step 10: Preparing apps and services...")
console.log("")

// Load .env file if it exists
const envPath = resolve(process.cwd(), ".env")
if (existsSync(envPath) && statSync(envPath).isFile()) {
  const envContent = readFileSync(envPath, "utf-8")
  envContent.split("\n").forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match && match[1] && match[2] && !line.startsWith("#")) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
  console.log("  ✓ Loaded configuration from .env")
}

const workspaceBase = process.env.WORKSPACE_BASE || "/var/apps"
const reposBase = process.env.GIT_REPO_BASE || "/home"
const swarmConfigDir = join(workspaceBase, "swarm-config")

console.log(`  Workspace: ${workspaceBase}`)
console.log(`  Git repos: ${reposBase}`)
console.log(`  Swarm config: ${swarmConfigDir}`)
console.log("")

// Set default branch name to 'main'
execSync("git config --global init.defaultBranch main")

interface AppConfig {
  name: string
  port: number
  owner: string
  createdAt: string
  legacy: true
}

// Get all regular users from the system
function getAvailableUsers(): string[] {
  // Try to get from environment variable first (for local dev)
  const envUser = process.env.DEFAULT_USER || process.env.USER

  try {
    const passwdContent = readFileSync("/etc/passwd", "utf-8")
    const users = passwdContent
      .split("\n")
      .filter(line => line.trim())
      .map(line => line.split(":"))
      .filter(fields => {
        const uid = parseInt(fields[2] || "0", 10)
        const username = fields[0]
        return uid >= 1000 && uid < 60000 && username !== "nobody"
      })
      .map(fields => fields[0]!)

    // If no users found (e.g., on macOS in dev), use current user
    if (users.length === 0 && envUser) {
      console.log(`  ℹ️  No regular system users found, using current user: ${envUser}`)
      return [envUser]
    }

    return users
  } catch (error) {
    // Fallback to current user if /etc/passwd is not readable
    if (envUser) {
      console.log(`  ℹ️  Using current user: ${envUser}`)
      return [envUser]
    }
    return []
  }
}

// Select owner user interactively or use default
async function selectOwner(users: string[]): Promise<string> {
  if (users.length === 1) {
    console.log(`  Only one user found: ${users[0]}`)
    return users[0]!
  }

  console.log("  Available users:")
  users.forEach((user, i) => console.log(`    ${i + 1}. ${user}`))
  console.log("")

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>(resolve => {
    rl.question(`  Select user (1-${users.length}): `, resolve)
  })
  rl.close()

  const choice = parseInt(answer, 10)
  if (choice >= 1 && choice <= users.length) {
    return users[choice - 1]!
  }

  console.log("  ⚠️  Invalid selection, using first user")
  return users[0]!
}

// Detect port from app directory
function detectPort(appDir: string): number {
  // Check .env file
  try {
    const envContent = readFileSync(join(appDir, ".env"), "utf-8")
    const portMatch = envContent.match(/^PORT=(\d+)/m)
    if (portMatch?.[1]) return parseInt(portMatch[1], 10)
  } catch (error) {
    // .env doesn't exist
  }

  // Check docker-compose files
  for (const file of ["docker-compose.yml", "docker-compose.yaml"]) {
    try {
      const composeContent = readFileSync(join(appDir, file), "utf-8")
      const portMatch = composeContent.match(/- "(\d+):/m)
      if (portMatch?.[1]) return parseInt(portMatch[1], 10)
    } catch (error) {
      // File doesn't exist
    }
  }

  // Check package.json
  try {
    const pkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf-8"))
    if (pkg.port) return parseInt(pkg.port, 10)
  } catch (error) {
    // package.json doesn't exist or is invalid
  }

  return 3000
}

// Create service configuration file and docker-compose for an app
function createServiceConfig(appName: string, port: number): void {
  const appDir = join(workspaceBase, appName)
  const swarmDir = join(appDir, ".swarm")
  const servicePath = join(swarmDir, "kong.yaml")
  const composePath = join(swarmDir, "docker-compose.yaml")

  // Create .swarm directory if it doesn't exist
  if (!existsSync(swarmDir)) {
    mkdirSync(swarmDir, { recursive: true })
  }

  // Get domain from environment
  const domain = process.env.DOMAIN || "example.com"

  // Create .swarm/kong.yaml if it doesn't exist
  if (!existsSync(servicePath)) {
    const serviceContent = `services:
  - name: ${appName}_${appName}
    url: http://${appName}_${appName}:${port}

routes:
  - name: ${appName}_${appName}
    hosts:
      - ${appName}.${domain}
    paths:
      - /
    protocols:
      - https
    preserve_host: true
    strip_path: false

    service: ${appName}_${appName}
`
    writeFileSync(servicePath, serviceContent, "utf-8")
    console.log(`  ✓ Created .swarm/kong.yaml`)
  }

  // Create .swarm/docker-compose.yaml if it doesn't exist
  if (!existsSync(composePath)) {
    const composeContent = `services:
  ${appName}:
    image: \${IMAGE_NAME:-${appName}:latest}
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "\${PORT:-${port}}:${port}"
    volumes:
      - ./data:/app/data
    networks:
      - kong-net
    labels:
      - "com.docker.stack.namespace=${appName}"

networks:
  kong-net:
    external: true
`
    writeFileSync(composePath, composeContent, "utf-8")
    console.log(`  ✓ Created .swarm/docker-compose.yaml`)
  }
}

// Create git repository for an app
function createGitRepository(appName: string, owner: string): void {
  const repoPath = join(reposBase, owner, `${appName}.git`)

  if (existsSync(repoPath)) {
    console.log(`  ✓ Repository exists: ${appName}`)
    return
  }

  const repoDir = dirname(repoPath)
  if (!existsSync(repoDir)) {
    mkdirSync(repoDir, { recursive: true })
  }

  execSync(`git init --bare "${repoPath}"`, { stdio: "inherit" })

  // Copy post-receive hook
  const hookSource = join(swarmConfigDir, "hooks/post-receive")
  const hookDest = join(repoPath, "hooks/post-receive")
  if (existsSync(hookSource)) {
    copyFileSync(hookSource, hookDest)
    chmodSync(hookDest, 0o755)
  }

  // Set ownership
  try {
    const uid = parseInt(execSync(`id -u ${owner}`, { encoding: "utf-8" }).trim(), 10)
    const gid = parseInt(execSync(`id -g ${owner}`, { encoding: "utf-8" }).trim(), 10)
    execSync(`chown -R ${uid}:${gid} "${repoPath}"`)
  } catch (error) {
    console.log(`  ⚠️  Could not set ownership for ${owner}`)
  }

  console.log(`  ✅ Created repository: ${repoPath}`)
}

// Save app config file
function saveAppConfig(appName: string, config: AppConfig): void {
  const configPath = join(workspaceBase, appName, ".repo-config.json")
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8")
  chmodSync(configPath, 0o644)
}

// Main execution
const availableUsers = getAvailableUsers()

if (availableUsers.length === 0) {
  console.log("  ⚠️  No regular users found, skipping migration")
  console.log("")
  process.exit(0)
}

const allDirs = readdirSync(workspaceBase, { withFileTypes: true }).filter(
  entry => entry.isDirectory() && !entry.name.startsWith("."),
)

if (allDirs.length === 0) {
  console.log(`  ℹ️  No apps found in ${workspaceBase}`)
  console.log("")
  process.exit(0)
}

// Find apps that need migration (no config or no owner)
const legacyApps = allDirs.filter(dir => {
  try {
    const config = JSON.parse(
      readFileSync(join(workspaceBase, dir.name, ".repo-config.json"), "utf-8"),
    )
    return !config.owner // Config exists but no owner
  } catch (error) {
    return true // No config file
  }
})

let selectedUser = ""

if (legacyApps.length > 0) {
  console.log(`  Found ${legacyApps.length} legacy app(s) that need migration`)
  selectedUser = await selectOwner(availableUsers)
  console.log(`  Using owner: ${selectedUser}`)
} else {
  console.log(`  ℹ️  No legacy apps found - checking repositories for existing apps`)
}

console.log("")
console.log("  Processing apps...")

const { migrated, updated, reposEnsured } = allDirs.reduce(
  (counts, dir) => {
    const appDir = join(workspaceBase, dir.name)
    const appName = dir.name

    // Process app migration/repository setup
    const port = detectPort(appDir)
    let createdAt: string
    try {
      const stats = statSync(appDir)
      createdAt = stats.birthtime.toISOString()
    } catch (error) {
      createdAt = new Date().toISOString()
    }

    const configPath = join(appDir, ".repo-config.json")
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"))
      if (!config.owner) {
        console.log(`  🔧 Updating config for: ${appName}`)
        config.owner = selectedUser
        saveAppConfig(appName, config)
        createGitRepository(appName, selectedUser)
        createServiceConfig(appName, port)
        counts.updated++
      } else {
        console.log(`  ✓ Checking repository for: ${appName}`)
        createGitRepository(appName, config.owner)
        createServiceConfig(appName, port)
        counts.reposEnsured++
      }
    } catch (error) {
      console.log(`  📦 Migrating app: ${appName} (port: ${port})`)
      const config: AppConfig = {
        name: appName,
        port: port,
        owner: selectedUser,
        createdAt: createdAt,
        legacy: true,
      }
      saveAppConfig(appName, config)
      createGitRepository(appName, selectedUser)
      createServiceConfig(appName, port)
      counts.migrated++
    }

    return counts
  },
  { migrated: 0, updated: 0, reposEnsured: 0 },
)

console.log("")
if (migrated > 0) {
  console.log(`  ✅ Migrated ${migrated} app(s)`)
}
if (updated > 0) {
  console.log(`  ✅ Updated ${updated} app(s)`)
}
if (reposEnsured > 0) {
  console.log(`  ✓ Ensured repositories for ${reposEnsured} app(s)`)
}
console.log("")
