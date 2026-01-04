#!/usr/bin/env node
import { exec, docker, imageExists } from "../lib/docker.js"
import { loadConfig } from "../lib/config.js"

console.log("🎨 Step 8: Building and deploying Swarm Config Web UI...")

const workDir = "/var/apps/swarm-config"
process.chdir(workDir)

// Build Docker image
console.log("  Building Web UI Docker image...")
try {
  docker("build -t swarm-config-ui:latest .")
} catch (error) {
  console.log("⚠️  Web UI build failed, but continuing...")
  console.log(
    "  Build it manually: cd /var/apps/swarm-config && docker build -t swarm-config-ui:latest .",
  )
  console.log("")
  process.exit(0)
}

// Check if image exists
if (!imageExists("swarm-config-ui")) {
  console.log("⚠️  Web UI image not available")
  console.log("")
  process.exit(0)
}

// Distribute image to swarm nodes
console.log("  Distributing image to all swarm nodes...")
try {
  const imageData = docker("save swarm-config-ui:latest", { encoding: null }) as Buffer
  exec("docker load", { input: imageData })
} catch (error) {
  // Continue anyway
}

// Copy to worker nodes if they exist
try {
  const workerNodes = docker("node ls --filter role=worker -q 2>/dev/null || true", {
    encoding: "utf-8",
  }) as string

  if (workerNodes.trim()) {
    console.log("  Copying image to worker nodes...")
    for (const node of workerNodes.trim().split("\n").filter(Boolean)) {
      try {
        const nodeIp = (
          docker(`node inspect "${node}" --format '{{.Status.Addr}}' 2>/dev/null || true`, {
            encoding: "utf-8",
          }) as string
        ).trim()

        if (nodeIp) {
          console.log(`    → ${nodeIp}`)
          const imageData = docker("save swarm-config-ui:latest", { encoding: null }) as Buffer
          exec(`ssh "${nodeIp}" docker load 2>/dev/null || true`, { input: imageData })
        }
      } catch (error) {
        // Continue with other nodes
      }
    }
  }
} catch (error) {
  // No worker nodes or error
}

// Load domain from config
const config = loadConfig()
const domain = config.DOMAIN

// Deploy stack
console.log("  Deploying Web UI stack (includes Kong)...")
try {
  docker("stack deploy --detach=true -c compose.yaml swarm-config", {
    env: { ...process.env, DOMAIN: domain },
  })
  console.log("  ✓ Stack deployed (Kong, Redis, Web UI)")
} catch (error) {
  console.error("❌ Failed to deploy Web UI stack")
  process.exit(1)
}

// Wait a moment for services to start
console.log("  Waiting for services to initialize...")
try {
  exec("sleep 5")
} catch (error) {
  // Continue anyway
}

// Force update service
console.log("  Updating service with new image...")
try {
  docker(
    "service update --image swarm-config-ui:latest --force swarm-config_ui 2>/dev/null || true",
  )
} catch (error) {
  // Service might not exist yet
}

// Regenerate Kong config
console.log("  Regenerating Kong configuration...")
try {
  exec("npx tsx src/generate-kong-config.ts")
  console.log("  Waiting for Kong to be ready before reloading...")
  exec("npx tsx src/reload-kong.ts")
  console.log("  ✓ Kong configuration reloaded")
} catch (error) {
  console.log("⚠️  Kong reload skipped (Kong may still be starting)")
  console.log("  You can reload manually later: npm run kong:reload")
}

console.log("✅ Web UI deployed")
console.log(`  Access at: https://config.${domain}`)
console.log("")
