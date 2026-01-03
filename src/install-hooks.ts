#!/usr/bin/env tsx
/**
 * Install Git Hooks Script
 *
 * Sets up Git hooks (pre-commit, pre-push) automatically by downloading them from GitHub
 * This script is called by npm postinstall and is CI/CD-safe
 *
 * The script will exit silently if:
 * - Not in a git repository
 * - Running in CI environment
 */

import { existsSync } from "fs"
import { writeFile, chmod } from "fs/promises"
import { resolve } from "path"

const HOOKS_BASE_URL = "https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/hooks"
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
    const url = `${HOOKS_BASE_URL}/${hookName}`
    const response = await fetch(url)

    if (!response.ok) {
      console.log(`⚠️  Could not fetch ${hookName} from GitHub (${response.status})`)
      return false
    }

    const content = await response.text()
    await writeFile(target, content)
    await chmod(target, 0o755)

    console.log(`✅ Installed ${hookName}`)
    return true
  } catch (error) {
    console.log(
      `⚠️  Could not fetch ${hookName}:`,
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

async function installHooks() {
  console.log("🔧 Setting up Git hooks from GitHub...")

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
