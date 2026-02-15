import { execSync } from "child_process"

// Check if Docker Swarm is active
export function isSwarmActive(): boolean {
  try {
    const output = execSync('docker info --format "{{.Swarm.LocalNodeState}}"', {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "ignore"],
    }).trim()
    return output === "active"
  } catch {
    return false
  }
}

// Get running stacks/containers and their status
export function getDockerStatus(stackName: string): {
  exists: boolean
  running: number
  total: number
} {
  try {
    const swarmActive = isSwarmActive()

    if (swarmActive) {
      // Get all services matching the pattern: stackName_*
      const services = execSync(
        `docker service ls --filter "name=${stackName}_" --format "{{.Name}}\t{{.Replicas}}"`,
        {
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "ignore"],
        },
      )
        .trim()
        .split("\n")
        .filter(Boolean)

      if (services.length === 0) {
        return { exists: false, running: 0, total: 0 }
      }

      let totalRunning = 0
      let totalReplicas = 0

      for (const service of services) {
        const parts = service.split("\t")
        const replica = parts[1]
        if (replica) {
          const match = replica.match(/(\d+)\/(\d+)/)
          if (match) {
            totalRunning += parseInt(match[1]!, 10)
            totalReplicas += parseInt(match[2]!, 10)
          }
        }
      }

      return { exists: true, running: totalRunning, total: totalReplicas }
    } else {
      // Local without Swarm: check running containers
      const containers = execSync(
        `docker ps -a --filter "name=${stackName}_" --format "{{.Names}}\t{{.State}}"`,
        {
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "ignore"],
        },
      )
        .trim()
        .split("\n")
        .filter(Boolean)

      if (containers.length === 0) {
        return { exists: false, running: 0, total: 0 }
      }

      const runningCount = containers.filter(line => line.includes("running")).length

      return { exists: true, running: runningCount, total: containers.length }
    }
  } catch (error) {
    return { exists: false, running: 0, total: 0 }
  }
}
