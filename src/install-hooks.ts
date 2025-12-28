#!/usr/bin/env tsx
/**
 * Install Git Hooks Script
 *
 * Sets up Git hooks (pre-commit, pre-push) automatically
 * This script is called by npm postinstall and is CI/CD-safe
 *
 * The script will exit silently if:
 * - Not in a git repository
 * - Server is unreachable
 * - Running in CI environment
 */

import { existsSync } from "fs"
import { mkdir, writeFile, chmod } from "fs/promises"
import { resolve } from "path"
import { config } from "./config.ts"

const SCRIPTS_URL = config.HOOKS_BASE_URL
const HOOK_DIR = ".git/hooks"

// Check if we're in a CI environment
function isCI() {
  return Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI)
}

// Silent exit if not in git repo or in CI
if (!existsSync(".git")) {
  process.exit(0)
}

if (isCI()) {
  process.exit(0)
}

async function fetchHook(hookName: string) {
  const target = resolve(HOOK_DIR, hookName)

  try {
    const response = await fetch(`${SCRIPTS_URL}/hooks/${hookName}`)

    if (!response.ok) {
      console.log(`⚠️  Could not fetch ${hookName} (server may be unreachable)`)
      return false
    }

    const content = await response.text()
    await writeFile(target, content)
    await chmod(target, 0o755)

    console.log(`✅ Installed ${hookName}`)
    return true
  } catch (error) {
    console.log(`⚠️  Could not fetch ${hookName} (server may be unreachable)`)
    return false
  }
}

async function installHooks() {
  console.log("🔧 Setting up Git hooks...")

  // Create hooks directory if it doesn't exist
  if (!existsSync(HOOK_DIR)) {
    await mkdir(HOOK_DIR, { recursive: true })
  }

  // Install hooks
  await fetchHook("pre-commit")
  await fetchHook("pre-push")

  console.log("")
  console.log("✅ Setup complete!")
}

installHooks().catch(error => {
  console.error(
    "❌ Failed to install hooks:",
    error instanceof Error ? error.message : String(error),
  )
  process.exit(1)
})
