#!/usr/bin/env tsx
/**
 * Server Bootstrap & Validation Script
 *
 * This script checks and configures the Docker Swarm server environment
 * according to the requirements specified in README.md
 *
 * Usage:
 *   npm run bootstrap      # Check and report issues
 *   npm run bootstrap:fix  # Check and auto-fix issues (requires sudo)
 */

import { readdir } from "fs/promises"
import { resolve, join } from "path"
import type { CheckResult } from "./bootstrap-helpers.js"

const checks: CheckResult[] = []

// Load check modules from src/checks directory
async function loadChecks() {
  const checksDir = resolve(process.cwd(), "src", "checks")
  const checkModules = []

  try {
    const files = await readdir(checksDir)
    const tsFiles = files.filter(f => f.endsWith(".ts"))

    for (const file of tsFiles) {
      const modulePath = join(checksDir, file)
      const module = await import(`file://${modulePath}`)
      if (module.default) {
        checkModules.push(module.default)
        console.log(`  ✓ checks/${file}`)
      }
    }
  } catch (error) {
    console.error(
      "❌ Failed to load checks:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }

  return checkModules
}

async function runChecks() {
  console.log("🔍 Running server bootstrap checks...")
  console.log("\nLoading checks:")

  const checkFunctions = await loadChecks()

  console.log("\nRunning checks:\n")

  for (const checkFn of checkFunctions) {
    checks.push(await checkFn())
  }

  console.log("\n📊 Results:\n")

  const passed = checks.filter(c => c.passed)
  const failed = checks.filter(c => !c.passed)

  for (const check of checks) {
    const icon = check.passed ? "✅" : "❌"
    console.log(`${icon} ${check.name}`)
    console.log(`   ${check.message}`)
  }

  console.log(`\n${passed.length}/${checks.length} checks passed\n`)

  if (failed.length > 0 && process.argv.includes("--fix")) {
    console.log("🔧 Attempting to fix issues...\n")
    for (const check of failed) {
      if (check.fix) {
        console.log(`Fixing: ${check.name}`)
        try {
          await check.fix()
          console.log(`✅ Fixed: ${check.name}`)
        } catch (error) {
          console.error(`❌ Failed to fix: ${check.name}`)
          console.error(`   ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        console.log(`⚠️  ${check.name} cannot be auto-fixed - manual intervention required`)
      }
    }
    console.log("\n🔄 Re-running checks...\n")
    checks.length = 0
    await runChecks()
  } else if (failed.length > 0) {
    console.log("💡 Run with --fix flag to automatically fix issues:")
    console.log("   npm run bootstrap:fix")
    process.exit(1)
  } else {
    console.log("✅ All checks passed! Server is ready.")
  }
}

runChecks().catch(error => {
  console.error("❌ Bootstrap failed:", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
