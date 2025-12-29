#!/usr/bin/env node
import { execSync } from 'child_process'
import { readdirSync, readFileSync, existsSync, mkdirSync, copyFileSync, chmodSync, chownSync } from 'fs'
import { join, dirname } from 'path'

console.log('🔍 Step 11: Ensuring Git repositories for all apps...')

const workspaceBase = process.env.WORKSPACE_BASE || '/var/apps'
const reposBase = process.env.GIT_REPO_BASE || '/home'
const swarmConfigDir = process.env.SWARM_CONFIG_DIR || '/var/apps/swarm-config'

// Set default branch name to 'main'
execSync('git config --global init.defaultBranch main')

// Find all apps with .repo-config.json
console.log('  Scanning for apps with configuration...')
const appsToCheck: Array<{ name: string; owner: string }> = []
const appsToFix: string[] = []

const entries = readdirSync(workspaceBase, { withFileTypes: true })
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name === 'swarm-config') {
    continue
  }

  const appDir = join(workspaceBase, entry.name)
  const configPath = join(appDir, '.repo-config.json')

  // Only process apps with .repo-config.json
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      if (!config.owner) {
        console.log(`  📦 Found app without owner: ${entry.name}`)
        appsToFix.push(entry.name)
      } else {
        console.log(`  📦 Found app: ${entry.name} (owner: ${config.owner})`)
        appsToCheck.push({ name: entry.name, owner: config.owner })
      }
    } catch (error) {
      console.log(`  ⚠️  Invalid .repo-config.json in ${entry.name}`)
    }
  }
}

// Handle apps without owner if any found
if (appsToFix.length > 0) {
  console.log('')
  console.log(`  ⚠️  Found ${appsToFix.length} app(s) without owner:`)
  for (const appName of appsToFix) {
    console.log(`      - ${appName}`)
  }
  console.log('')
  console.log('  Please run Step 11 (migrate-legacy-apps) first to set owners.')
  console.log("  Or manually add 'owner' field to .repo-config.json files.")
  console.log('')
}

// Check and create repositories
let createdCount = 0
let existsCount = 0

for (const app of appsToCheck) {
  const repoPath = join(reposBase, app.owner, `${app.name}.git`)

  if (!existsSync(repoPath)) {
    console.log(`  📁 Creating git repository: ${repoPath}`)
    const repoDir = dirname(repoPath)
    if (!existsSync(repoDir)) {
      mkdirSync(repoDir, { recursive: true })
    }

    execSync(`git init --bare "${repoPath}"`, { stdio: 'inherit' })

    // Copy post-receive hook if available
    const hookSource = join(swarmConfigDir, 'hooks/post-receive')
    const hookDest = join(repoPath, 'hooks/post-receive')
    if (existsSync(hookSource)) {
      copyFileSync(hookSource, hookDest)
      chmodSync(hookDest, 0o755)
      console.log('  🪝 Installed post-receive hook')
    }

    // Set ownership
    try {
      // Get user's UID from passwd
      const userInfo = execSync(`id -u ${app.owner}`, { encoding: 'utf-8' }).trim()
      const uid = parseInt(userInfo, 10)
      const gid = parseInt(
        execSync(`id -g ${app.owner}`, { encoding: 'utf-8' }).trim(),
        10
      )

      // Recursively change ownership
      execSync(`chown -R ${uid}:${gid} "${repoPath}"`)
    } catch (error) {
      console.log(`  ⚠️  Could not set ownership for ${app.owner}`)
    }

    console.log(`  ✅ Repository created for ${app.name}`)
    createdCount++
  } else {
    console.log(`  ✓ Repository exists: ${app.name}`)
    existsCount++
  }
}

console.log('')
if (createdCount > 0) {
  console.log(`  ✅ Created ${createdCount} new repository/repositories`)
}
if (existsCount > 0) {
  console.log(`  ℹ️  ${existsCount} repository/repositories already existed`)
}
console.log('')
