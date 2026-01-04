#!/usr/bin/env node
import { exec, docker } from "../lib/docker.js"
import { runStep } from "../lib/step.js"
import { execSync } from "child_process"

await runStep(
  "02-install-docker",
  "🐳 Step 2: Installing Docker and initializing Swarm...",
  async () => {
    // Check if Docker is already installed and working
    try {
      // Try to run docker ps - if it works, Docker is installed and running
      const dockerVersion = exec("docker --version", { encoding: "utf-8" }) as string
      exec("docker ps")

      console.log(`  ✅ Docker already installed and running: ${dockerVersion.trim()}`)

      // Check if there are running containers
      const runningContainers = (exec("docker ps -q", { encoding: "utf-8" }) as string)
        .split("\n")
        .filter(Boolean).length
      if (runningContainers > 0) {
        console.log(`  ℹ️  Found ${runningContainers} running container(s)`)
      }
    } catch {
      // Docker not working or not installed
      try {
        exec('dpkg -l | grep -qE "containerd|docker"')
        console.log("  ⚠️  Found conflicting Docker packages")
        console.log(
          "  Removing conflicting packages (data in /var/lib/docker will be preserved)...",
        )
        exec("apt remove -y containerd docker docker-engine docker.io runc 2>/dev/null || true")
      } catch {
        // No conflicting packages
      }

      // Install Docker
      console.log("  Installing Docker...")
      exec("apt update")
      exec("apt install -y docker.io")

      console.log("  ✅ Docker installed")
    }

    // Initialize Docker Swarm
    const swarmState = (
      docker('info --format "{{.Swarm.LocalNodeState}}" 2>/dev/null || echo "inactive"', {
        encoding: "utf-8",
      }) as string
    ).trim()

    if (swarmState === "active") {
      console.log("  ✅ Docker Swarm already initialized")
    } else {
      console.log("  Initializing Docker Swarm...")
      exec("docker swarm init")
      console.log("  ✅ Docker Swarm initialized")
    }

    console.log("✅ Docker and Swarm ready")
  },
)
