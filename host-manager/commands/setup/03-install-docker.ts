import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "03-install-docker",
  name: "Install Docker",
  description: "Install Docker and initialize Swarm mode",

  async check() {
    try {
      const dockerCheck = await executeOnHost("docker --version && docker ps")
      const swarmCheck = await executeOnHost("docker info --format '{{.Swarm.LocalNodeState}}'")
      return dockerCheck.exitCode === 0 && swarmCheck.stdout.trim() === "active"
    } catch {
      return false
    }
  },

  async *execute() {
    yield "Checking Docker installation..."

    const dockerInstalled = await executeOnHost("docker --version && docker ps 2>/dev/null")

    if (dockerInstalled.exitCode === 0) {
      const version = await executeOnHost("docker --version")
      yield `✅ Docker already installed: ${version.stdout.trim()}`

      const containers = await executeOnHost("docker ps -q")
      const count = containers.stdout.split("\n").filter(Boolean).length
      if (count > 0) {
        yield `ℹ️  Found ${count} running container(s)`
      }
    } else {
      const conflictCheck = await executeOnHost(
        'dpkg -l | grep -qE "containerd|docker" && echo conflict || echo clean',
      )

      if (conflictCheck.stdout.trim() === "conflict") {
        yield "⚠️  Found conflicting Docker packages"
        yield "Removing conflicting packages..."
        await executeOnHost(
          "apt remove -y containerd docker docker-engine docker.io runc 2>/dev/null || true",
        )
      }

      yield "Installing Docker..."
      await executeOnHost("apt update")
      await executeOnHost("DEBIAN_FRONTEND=noninteractive apt install -y docker.io")
      yield "✅ Docker installed"
    }

    yield "Checking Docker Swarm..."
    const swarmState = await executeOnHost(
      'docker info --format "{{.Swarm.LocalNodeState}}" 2>/dev/null || echo inactive',
    )

    if (swarmState.stdout.trim() === "active") {
      yield "✅ Docker Swarm already initialized"
    } else {
      yield "Initializing Docker Swarm..."
      await executeOnHost("docker swarm init")
      yield "✅ Docker Swarm initialized"
    }

    yield "✅ Docker and Swarm ready"
    return { success: true }
  },
})
