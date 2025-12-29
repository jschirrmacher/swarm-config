#!/usr/bin/env node
import { execSync } from 'child_process'
import { readdirSync, readFileSync, writeFileSync, statSync, chmodSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { createInterface } from 'readline'

console.log('🔄 Step 10: Migrating legacy apps to swarm-config...')

const workspaceBase = process.env.WORKSPACE_BASE || '/var/apps'
const reposBase = process.env.GIT_REPO_BASE || '/home'
const swarmConfigDir = process.env.SWARM_CONFIG_DIR || '/var/apps/swarm-config'

// Set default branch name to 'main'
execSync('git config --global init.defaultBranch main')

interface AppConfig {
  name: string
  port: number
  owner: string
  createdAt: string
  legacy: true
}

// Get all regular users from the system
function getAvailableUsers(): string[] {
  const passwdContent = readFileSync('/etc/passwd', 'utf-8')
  return passwdContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.split(':'))
    .filter(fields => {
      const uid = parseInt(fields[2] || '0', 10)
      const username = fields[0]
      return uid >= 1000 && uid < 60000 && username !== 'nobody'
    })
    .map(fields => fields[0]!)
}

// Select owner user interactively or use default
async function selectOwner(users: string[]): Promise<string> {
  if (users.length === 1) {
    console.log(`  Only one user found: ${users[0]}`)
    return users[0]!
  }

  if (process.stdin.isTTY) {
    console.log('  Available users:')
    users.forEach((user, i) => console.log(`    ${i + 1}. ${user}`))
    console.log('')

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await new Promise<string>((resolve) => {
      rl.question(`  Select user (1-${users.length}): `, resolve)
    })
    rl.close()

    const choice = parseInt(answer, 10)
    if (choice >= 1 && choice <= users.length) {
      return users[choice - 1]!
    }
    
    console.log('  ⚠️  Invalid selection, skipping migration')
    console.log('')
    process.exit(0)
  }

  console.log(`  Using first user in non-interactive mode: ${users[0]}`)
  return users[0]!
}

// Detect port from app directory
function detectPort(appDir: string): number {
  // Check .env file
  try {
    const envContent = readFileSync(join(appDir, '.env'), 'utf-8')
    const portMatch = envContent.match(/^PORT=(\d+)/m)
    if (portMatch?.[1]) return parseInt(portMatch[1], 10)
  } catch (error) {
    // .env doesn't exist
  }

  // Check docker-compose files
  for (const file of ['docker-compose.yml', 'docker-compose.yaml']) {
    try {
      const composeContent = readFileSync(join(appDir, file), 'utf-8')
      const portMatch = composeContent.match(/- "(\d+):/m)
      if (portMatch?.[1]) return parseInt(portMatch[1], 10)
    } catch (error) {
      // File doesn't exist
    }
  }

  // Check package.json
  try {
    const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
    if (pkg.port) return parseInt(pkg.port, 10)
  } catch (error) {
    // package.json doesn't exist or is invalid
  }

  return 3000
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

  execSync(`git init --bare "${repoPath}"`, { stdio: 'inherit' })

  // Copy post-receive hook
  const hookSource = join(swarmConfigDir, 'hooks/post-receive')
  const hookDest = join(repoPath, 'hooks/post-receive')
  if (existsSync(hookSource)) {
    copyFileSync(hookSource, hookDest)
    chmodSync(hookDest, 0o755)
  }

  // Set ownership
  try {
    const uid = parseInt(execSync(`id -u ${owner}`, { encoding: 'utf-8' }).trim(), 10)
    const gid = parseInt(execSync(`id -g ${owner}`, { encoding: 'utf-8' }).trim(), 10)
    execSync(`chown -R ${uid}:${gid} "${repoPath}"`)
  } catch (error) {
    console.log(`  ⚠️  Could not set ownership for ${owner}`)
  }

  console.log(`  ✅ Created repository: ${repoPath}`)
}

// Save app config file
function saveAppConfig(appName: string, config: AppConfig): void {
  const configPath = join(workspaceBase, appName, '.repo-config.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  chmodSync(configPath, 0o644)
}

// Main execution
const availableUsers = getAvailableUsers()

if (availableUsers.length === 0) {
  console.log('  ⚠️  No regular users found, skipping migration')
  console.log('')
  process.exit(0)
}

const selectedUser = await selectOwner(availableUsers)
console.log(`  Using owner: ${selectedUser}`)

// Check for legacy apps
const entries = readdirSync(workspaceBase, { withFileTypes: true })
const dirs = entries.filter(
  (entry) => entry.isDirectory() && entry.name !== 'swarm-config' && entry.name !== selectedUser
)

if (dirs.length === 0) {
  console.log(`  ℹ️  No legacy apps found in ${workspaceBase}`)
  console.log('')
  process.exit(0)
}

console.log(`  Found ${dirs.length} potential legacy app(s)`)
console.log('  Processing apps...')
console.log('')

const { migrated, updated, skipped} = dirs.reduce((counts, dir) => {
  const appDir = join(workspaceBase, dir.name)
  const appName = dir.name

  const port = detectPort(appDir)
  let createdAt: string
  try {
    const stats = statSync(appDir)
    createdAt = stats.birthtime.toISOString()
  } catch (error) {
    createdAt = new Date().toISOString()
  }

  // Check if already has .repo-config.json
  const configPath = join(appDir, '.repo-config.json')
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (!config.owner) {
      // Update existing config with owner
      console.log(`  🔧 Updating config for: ${appName}`)
      config.owner = selectedUser
      saveAppConfig(appName, config)
      createGitRepository(appName, selectedUser)
      counts.updated++
    } else {
      // Already fully migrated
      console.log(`  ✅ Already migrated: ${appName}`)
      counts.skipped++
    }
  } catch (error) {
    // Create new config
    console.log(`  📦 Migrating app: ${appName} (port: ${port})`)
    const config: AppConfig = {
      name: appName,
      port: port,
      owner: selectedUser,
      createdAt: createdAt,
      legacy: true
    }
    saveAppConfig(appName, config)
    createGitRepository(appName, selectedUser)
    counts.migrated++
  }
  
  return counts
}, { migrated: 0, updated: 0, skipped: 0 })

console.log('')
if (migrated > 0) {
  console.log(`  ✅ Migrated ${migrated} app(s)`)
}
if (updated > 0) {
  console.log(`  ✅ Updated ${updated} app(s)`)
}
if (skipped > 0) {
  console.log(`  ℹ️ Skipped ${skipped} already migrated app(s)`)
}
console.log('')
