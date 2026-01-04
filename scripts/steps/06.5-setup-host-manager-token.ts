#!/usr/bin/env node
import { exec, docker } from "../lib/docker.js"
import { runStep } from "../lib/step.js"
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs"

await runStep(
  "06.5-setup-host-manager-token",
  "Setting up host-manager authentication...",
  async () => {
    // Check if running in Docker Swarm mode
    let isSwarmMode = false
    try {
      const swarmInfo = docker("info --format '{{.Swarm.LocalNodeState}}'", {
        encoding: "utf-8",
      }) as string
      isSwarmMode = swarmInfo.trim() === "active"
    } catch (error) {
      console.log("  ℹ️  Docker Swarm not active")
    }

    if (isSwarmMode) {
      console.log("  Docker Swarm detected - setting up secret...")

      // Check if secret already exists
      try {
        docker("secret inspect host_manager_token 2>/dev/null")
        console.log("  ✓ Secret 'host_manager_token' already exists")
      } catch (error) {
        // Secret doesn't exist, create it
        console.log("  Creating new token secret...")
        try {
          const token = exec("openssl rand -hex 32", { encoding: "utf-8" }) as string
          docker("secret create host_manager_token -", {
            input: token.trim(),
          })
          console.log("  ✓ Secret 'host_manager_token' created")
        } catch (createError) {
          console.log("  ⚠️  Failed to create secret, will use environment variable fallback")
        }
      }
    } else {
      console.log("  Docker Compose mode - checking .env file...")

      const envPath = "/var/apps/swarm-config/.env"

      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, "utf-8")
        if (envContent.includes("HOST_MANAGER_TOKEN=")) {
          console.log("  ✓ HOST_MANAGER_TOKEN found in .env file")
        } else {
          console.log("  Adding HOST_MANAGER_TOKEN to .env file...")
          try {
            const token = exec("openssl rand -hex 32", { encoding: "utf-8" }) as string
            appendFileSync(envPath, `HOST_MANAGER_TOKEN=${token.trim()}\n`)
            console.log("  ✓ Token added to .env file")
          } catch (error) {
            console.log("  ⚠️  Failed to add token to .env")
          }
        }
      } else {
        console.log("  Creating .env file with token...")
        try {
          const token = exec("openssl rand -hex 32", { encoding: "utf-8" }) as string
          writeFileSync(envPath, `HOST_MANAGER_TOKEN=${token.trim()}\n`)
          console.log("  ✓ .env file created with token")
        } catch (error) {
          console.log("  ⚠️  Failed to create .env file")
        }
      }
    }

    console.log("✅ host-manager authentication configured")
  },
)
