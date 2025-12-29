#!/usr/bin/env node
import { execSync } from 'child_process'
import { readdirSync, readFileSync, writeFileSync, statSync, chmodSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'

console.log('🔄 Step 10: Migrating legacy apps to swarm-config...')

// Get all regular users from the system (skip root and system users)
const usersOutput = execSync(
  `awk -F: '$3 >= 1000 && $3 < 60000 && $1 != "nobody" {print $1}' /etc/passwd`,
  { encoding: 'utf-8' }
)
const availableUsers = usersOutput.trim().split('\n').filter(Boolean)

if (availableUsers.length === 0) {
  console.log('  ⚠️  No regular users found, skipping migration')
  console.log('')
  process.exit(0)
}

// Select user
let selectedUser: string
if (availableUsers.length === 1) {
  selectedUser = availableUsers[0]
  console.log(`  Only one user found: ${selectedUser}`)
} else if (process.stdin.isTTY) {
  // Interactive mode - let user choose
  console.log('  Available users:')
  availableUsers.forEach((user, i) => {
    console.log(`    ${i + 1}. ${user}`)
  })
  console.log('')

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question(`  Select user (1-${availableUsers.length}): `, resolve)
  })
  rl.close()

  const choice = parseInt(answer, 10)
  if (choice >= 1 && choice <= availableUsers.length) {
    selectedUser = availableUsers[choice - 1]
  } else {
    console.log('  ⚠️  Invalid selection, skipping migration')
    console.log('')
    process.exit(0)
  }
} else {
  // Non-interactive mode - use first user
  selectedUser = availableUsers[0]
}

console.log(`  Using owner: ${selectedUser}`)

const workspaceBase = process.env.WORKSPACE_BASE || '/var/apps'

// Check if there are any potential legacy apps
const entries = readdirSync(workspaceBase, { withFileTypes: true })
const legacyDirs = entries.filter(
  (entry) => entry.isDirectory() && entry.name !== 'swarm-config' && entry.name !== selectedUser
)

if (legacyDirs.length === 0) {
  console.log(`  ℹ️  No legacy apps found in ${workspaceBase}`)
  console.log('')
  process.exit(0)
}

console.log(`  Found ${legacyDirs.length} potential legacy app(s)`)

// Function to detect port from app directory
function detectPort(appDir: string): number {
  // Check .env file
  try {
    const envContent = readFileSync(join(appDir, '.env'), 'utf-8')
    const portMatch = envContent.match(/^PORT=(\d+)/m)
    if (portMatch) return parseInt(portMatch[1], 10)
  } catch (error) {
    // .env doesn't exist
  }

  // Check docker-compose files
  for (const file of ['docker-compose.yml', 'docker-compose.yaml']) {
    try {
      const composeContent = readFileSync(join(appDir, file), 'utf-8')
      const portMatch = composeContent.match(/- "(\d+):/m)
      if (portMatch) return parseInt(portMatch[1], 10)
    } catch (error) {
      // File doesn't exist
    }
  }

  // Check package.json
  try {
    const pkgContent = readFileSync(join(appDir, 'package.json'), 'utf-8')
    const pkg = JSON.parse(pkgContent)
    if (pkg.port) return parseInt(pkg.port, 10)
  } catch (error) {
    // package.json doesn't exist or is invalid
  }

  return 3000
}

// Scan and preview apps
console.log('  Scanning for apps...')
const appsToMigrate: Array<{ name: string; port: number; createdAt: string }> = []
const appsToUpdate: Array<{ name: string; port: number; createdAt: string }> = []

for (const entry of legacyDirs) {
  const appDir = join(workspaceBase, entry.name)
  const appName = entry.name

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
      console.log(`  🔧 Config exists but missing owner: ${appName}`)
      appsToUpdate.push({ name: appName, port, createdAt })
    } else {
      console.log(`  ✅ Already migrated: ${appName}`)
    }
  } catch (error) {
    console.log(`  📦 Found app: ${appName} (port: ${port})`)
    appsToMigrate.push({ name: appName, port, createdAt })
  }
}

// Ask for confirmation
console.log('')
console.log(`  📋 Found ${appsToMigrate.length} app(s) to migrate`)
if (appsToUpdate.length > 0) {
  console.log(`  🔧 Found ${appsToUpdate.length} app(s) to update (missing owner)`)
}
console.log('')

if (process.stdin.isTTY && (appsToMigrate.length > 0 || appsToUpdate.length > 0)) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question('  Do you want to proceed? [Y/n] ', resolve)
  })
  rl.close()

  if (answer.toLowerCase() === 'n') {
    console.log('  ⏭️  Migration skipped')
    console.log('')
    process.exit(0)
  }
}

// Perform migration for new apps
if (appsToMigrate.length > 0) {
  console.log('  Creating config files for new apps...')
}

for (const app of appsToMigrate) {
  const configPath = join(workspaceBase, app.name, '.repo-config.json')
  const config = {
    name: app.name,
    port: app.port,
    owner: selectedUser,
    createdAt: app.createdAt,
    legacy: true
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  chmodSync(configPath, 0o644)
  console.log(`  ✅ Created: ${configPath}`)
}

// Update existing configs without owner
if (appsToUpdate.length > 0) {
  console.log('  Updating existing configs with missing owner...')
}

for (const app of appsToUpdate) {
  const configPath = join(workspaceBase, app.name, '.repo-config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  config.owner = selectedUser

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  chmodSync(configPath, 0o644)
  console.log(`  ✅ Updated: ${configPath}`)
}

console.log('')
if (appsToMigrate.length > 0) {
  console.log(`  ✅ Migration complete! Migrated ${appsToMigrate.length} app(s)`)
}
if (appsToUpdate.length > 0) {
  console.log(`  ✅ Updated ${appsToUpdate.length} existing app(s)`)
}
if (appsToMigrate.length > 0 || appsToUpdate.length > 0) {
  console.log('  ℹ️  Run Step 12 to create Git repositories')
}
console.log('')
