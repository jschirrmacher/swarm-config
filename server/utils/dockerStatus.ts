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
      // On server with Swarm: check if stack exists
      const stacks = execSync('docker stack ls --format "{{.Name}}"', {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "ignore"],
      })
        .trim()
        .split("\n")
        .filter(Boolean)

      if (!stacks.includes(stackName)) {
        return { exists: false, running: 0, total: 0 }
      }

      // Get service replicas for the stack
      const services = execSync(`docker stack services ${stackName} --format "{{.Replicas}}"`, {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "ignore"],
      })
        .trim()
        .split("\n")
        .filter(Boolean)

      let totalRunning = 0
      let totalReplicas = 0

      for (const replica of services) {
        const match = replica.match(/(\d+)\/(\d+)/)
        if (match) {
          totalRunning += parseInt(match[1]!, 10)
          totalReplicas += parseInt(match[2]!, 10)
        }
      }

      return { exists: true, running: totalRunning, total: totalReplicas }
    } else {
      // Local without Swarm: check running containers
      // Docker Compose creates containers with pattern: projectname-servicename-number or projectname_servicename_number
      // We search for containers that start with the stack name
      const containers = execSync(
        `docker ps --filter "name=^${stackName}" --format "{{.Names}}\t{{.State}}"`,
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

      // In non-swarm mode, all found containers are considered as expected to run
      return { exists: true, running: runningCount, total: containers.length }
    }
  } catch (error) {
    return { exists: false, running: 0, total: 0 }
  }
}
