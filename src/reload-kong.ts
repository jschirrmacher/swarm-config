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
  // Find Kong container
  const { stdout: containerName } = await execAsync(
    'docker ps --format "{{.Names}}" | grep _kong.1',
  )
  const kong = containerName.trim()

  if (!kong) {
    console.error("✗ Kong container not found")
    console.error("  Make sure Kong is running: docker service ls | grep kong")
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
