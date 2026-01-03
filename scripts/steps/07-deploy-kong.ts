#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { existsSync, mkdirSync } from "fs"

console.log("🦍 Step 7: Preparing Kong API Gateway...")

const workDir = "/var/apps/swarm-config"
process.chdir(workDir)

// Ensure redis-data directory exists with correct permissions
console.log("  Setting up Redis data directory...")
const redisDataDir = `${workDir}/redis-data`
if (!existsSync(redisDataDir)) {
  mkdirSync(redisDataDir, { recursive: true })
}

// Fix ownership recursively for all files (including existing ones)
try {
  exec(`chown -R 1001:1001 "${redisDataDir}"`)
  exec(`chmod 755 "${redisDataDir}"`)
  // Fix permissions on dump.rdb if it exists
  if (existsSync(`${redisDataDir}/dump.rdb`)) {
    exec(`chmod 644 "${redisDataDir}/dump.rdb"`)
  }
} catch (error) {
  console.warn("  ⚠️  Could not fix Redis data permissions (might need sudo)")
}

// Generate Kong configuration
console.log("  Generating Kong configuration...")
try {
  exec("npx tsx src/generate-kong-config.ts")
} catch (error) {
  console.error("❌ Failed to generate Kong configuration")
  process.exit(1)
}

console.log("✅ Kong preparation complete")
console.log("  (Kong will be deployed together with Web UI in next step)")
console.log("")
