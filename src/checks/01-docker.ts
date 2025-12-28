import { execAsync, commandExists, runCommand, type CheckResult } from "../bootstrap-helpers.ts"

export default async function checkDocker(): Promise<CheckResult> {
  const dockerExists = await commandExists("docker")
  
  if (!dockerExists) {
    return {
      name: "Docker & Swarm",
      passed: false,
      message: "Docker is not installed",
      fix: async () => {
        console.log("  Installing Docker...")
        await execAsync("sudo apt update && sudo apt install -y docker.io")
        console.log("  Initializing Docker Swarm...")
        await execAsync("docker swarm init")
      },
    }
  }

  // Docker is installed, check Swarm status
  try {
    const { stdout } = await runCommand("docker info --format '{{.Swarm.LocalNodeState}}'")
    const isSwarmActive = stdout.trim() === "active"
    
    return {
      name: "Docker & Swarm",
      passed: isSwarmActive,
      message: isSwarmActive
        ? "Docker installed and Swarm is active"
        : "Docker installed but Swarm is not initialized",
      fix: async () => {
        console.log("  Initializing Docker Swarm...")
        await execAsync("docker swarm init")
      },
    }
  } catch {
    return {
      name: "Docker & Swarm",
      passed: false,
      message: "Docker installed but cannot check Swarm status (Docker not running?)",
      fix: async () => {
        console.log("  Initializing Docker Swarm...")
        await execAsync("docker swarm init")
      },
    }
  }
}
