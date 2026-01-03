#!/usr/bin/env tsx
/**
 * Reload Kong with new configuration
 *
 * This script reloads Kong Gateway with the generated configuration
 * from generated/kong.yaml
 */

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

console.log("Reloading Kong...")

try {
  // Find Kong container - wait up to 30 seconds for it to be ready
  let kong = ""
  let attempts = 0
  const maxAttempts = 30

  while (!kong && attempts < maxAttempts) {
    try {
      const { stdout: containerName } = await execAsync(
        'docker ps --format "{{.Names}}" | grep "swarm-config_kong"',
      )
      kong = containerName.trim()
    } catch (error) {
      // Container not found yet, wait
      if (attempts === 0) {
        console.log("  Waiting for Kong container to start...")
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
    }
  }

  if (!kong) {
    console.error("✗ Kong container not found after 30 seconds")
    console.error("  Make sure Kong is running: docker service ls | grep swarm-config")
    process.exit(1)
  }

  // Validate configuration
  console.log("  Validating configuration...")
  await execAsync(`docker exec ${kong} kong config parse /config/kong.yaml`)
  console.log("  ✓ Configuration valid")

  // Reload Kong
  console.log("  Reloading Kong...")
  await execAsync(`docker exec ${kong} kong reload`)
  console.log("✓ Kong reloaded successfully")
} catch (error) {
  console.error("✗ Failed to reload Kong:", error instanceof Error ? error.message : String(error))
  process.exit(1)
}
