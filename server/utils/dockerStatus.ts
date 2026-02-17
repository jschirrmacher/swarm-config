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
  // Skip hidden directories
  if (stackName.startsWith('.')) {
    return { exists: false, running: 0, total: 0 }
  }

  try {
    const isDevelopment = process.env.NODE_ENV === 'development'
    console.log(`Checking Docker status for: ${stackName}, Mode: ${isDevelopment ? 'development' : 'production'}`)

    if (isDevelopment) {
      // Development: Docker Compose
      // Check for running compose project
      const lsOutput = execSync(
        `docker compose ls --filter "name=${stackName}" --format json`,
        {
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "ignore"],
        },
      ).trim()

      if (!lsOutput) {
        return { exists: false, running: 0, total: 0 }
      }

      try {
        const projects = JSON.parse(lsOutput)
        const project = Array.isArray(projects) ? projects[0] : projects
        
        if (!project) {
          return { exists: false, running: 0, total: 0 }
        }

        // Get container status for this project
        const psOutput = execSync(
          `docker compose -p ${stackName} ps --format json`,
          {
            encoding: "utf-8",
            timeout: 5000,
            stdio: ["pipe", "pipe", "ignore"],
          },
        ).trim()

        if (!psOutput) {
          return { exists: false, running: 0, total: 0 }
        }

        const containerLines = psOutput.split('\n').filter(Boolean)
        const containerList = containerLines.map(line => JSON.parse(line))
        const running = containerList.filter(c => c.State === 'running').length

        return { exists: true, running, total: containerList.length }
      } catch {
        return { exists: false, running: 0, total: 0 }
      }
    } else {
      // Production: Docker Swarm
      const swarmActive = isSwarmActive()
      if (!swarmActive) {
        return { exists: false, running: 0, total: 0 }
      }

      // Check if stack exists
      const stacks = execSync('docker stack ls --format "{{.Name}}"', {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "ignore"],
      }).trim().split('\n').filter(Boolean)

      if (!stacks.includes(stackName)) {
        console.log(`Stack ${stackName} not found`)
        return { exists: false, running: 0, total: 0 }
      }

      // Get services in the stack
      const servicesOutput = execSync(
        `docker stack services ${stackName} --format "{{.Name}}\t{{.Replicas}}"`,
        {
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "ignore"],
        },
      ).trim()

      if (!servicesOutput) {
        return { exists: true, running: 0, total: 0 }
      }

      const services = servicesOutput.split("\n").filter(Boolean)
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

      console.log(`${stackName}: ${totalRunning}/${totalReplicas} replicas`)
      return { exists: true, running: totalRunning, total: totalReplicas }
    }
  } catch (error) {
    console.error(`Error checking Docker status for ${stackName}:`, error)
    return { exists: false, running: 0, total: 0 }
  }
}
