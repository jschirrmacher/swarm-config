#!/usr/bin/env node
import { exec, docker, imageExists } from "../lib/docker.js"
import { loadConfig } from "../lib/config.js"
import { runStep } from "../lib/step.js"

await runStep("08-deploy-webui", "Building and deploying Swarm Config Web UI...", async () => {
  const workDir = "/var/apps/swarm-config"
  process.chdir(workDir)

  // Build host-manager Docker image
  console.log("Building host-manager Docker image...")
  try {
    process.chdir(`${workDir}/host-manager`)
    docker("build -t host-manager:latest .")
    process.chdir(workDir)
  } catch (error) {
    console.log("⚠️  host-manager build failed, but continuing...")
    console.log(
      "  Build it manually: cd /var/apps/swarm-config/host-manager && docker build -t host-manager:latest .",
    )
  }

  // Build Web UI Docker image
  console.log("Building Web UI Docker image...")
  docker("build -t swarm-config-ui:latest .")

  // Check if image exists
  if (!imageExists("swarm-config-ui")) {
    throw new Error("Web UI image not available")
  }

  // Distribute images to swarm nodes
  console.log("Distributing images to all swarm nodes...")
  try {
    // Distribute host-manager image
    if (imageExists("host-manager")) {
      const hostManagerData = docker("save host-manager:latest", { encoding: null }) as Buffer
      docker("load", { input: hostManagerData })
    }

    // Distribute UI image
    const imageData = docker("save swarm-config-ui:latest", { encoding: null }) as Buffer
    docker("load", { input: imageData })
  } catch (error) {
    // Continue anyway
  }

  // Copy to worker nodes if they exist
  try {
    const workerNodes = docker("node ls --filter role=worker -q 2>/dev/null || true", {
      encoding: "utf-8",
    }) as string

    if (workerNodes.trim()) {
      console.log("Copying images to worker nodes...")
      for (const node of workerNodes.trim().split("\n").filter(Boolean)) {
        try {
          const nodeIp = (
            docker(`node inspect "${node}" --format '{{.Status.Addr}}' 2>/dev/null || true`, {
              encoding: "utf-8",
            }) as string
          ).trim()

          if (nodeIp) {
            console.log(`  → ${nodeIp}`)

            // Copy host-manager image
            if (imageExists("host-manager")) {
              const hostManagerData = docker("save host-manager:latest", {
                encoding: null,
              }) as Buffer
              exec(`ssh "${nodeIp}" docker load 2>/dev/null || true`, { input: hostManagerData })
            }

            // Copy UI image
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
  console.log("Deploying Web UI stack (includes Kong, host-manager)...")
  docker("stack deploy --detach=true -c compose.yaml swarm-config", {
    env: { ...process.env, DOMAIN: domain },
  })
  console.log("✓ Stack deployed (Kong, Redis, Web UI, host-manager)")

  // Wait a moment for services to start
  console.log("Waiting for services to initialize...")
  try {
    exec("sleep 5")
  } catch (error) {
    // Continue anyway
  }

  // Force update services
  console.log("Updating services with new images...")
  try {
    docker(
      "service update --image swarm-config-ui:latest --force swarm-config_ui 2>/dev/null || true",
    )
    docker(
      "service update --image host-manager:latest --force swarm-config_host-manager 2>/dev/null || true",
    )
  } catch (error) {
    // Services might not exist yet
  }

  // Regenerate Kong config
  console.log("Regenerating Kong configuration...")
  try {
    exec("npx tsx src/generate-kong-config.ts")
    console.log("Waiting for Kong to be ready before reloading...")
    exec("npx tsx src/reload-kong.ts")
    console.log("✓ Kong configuration reloaded")
  } catch (error) {
    console.log("⚠️  Kong reload skipped (Kong may still be starting)")
    console.log("  You can reload manually later: npm run kong:reload")
  }

  console.log("✓ Web UI deployed")
  console.log(`  Access at: https://config.${domain}`)
})
