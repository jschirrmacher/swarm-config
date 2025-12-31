import { readdirSync, existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"

// Check if Docker Swarm is active
function isSwarmActive(): boolean {
  try {
    const output = execSync('docker info --format "{{.Swarm.LocalNodeState}}"', {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim()
    return output === "active"
  } catch {
    return false
  }
}

// Get running stacks/containers and their status
function getDockerStatus(stackName: string): { exists: boolean; running: number; total: number } {
  try {
    const swarmActive = isSwarmActive()

    if (swarmActive) {
      // On server with Swarm: check if stack exists
      const stacks = execSync('docker stack ls --format "{{.Name}}"', {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore']
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
        stdio: ['pipe', 'pipe', 'ignore']
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
      // Local without Swarm: check running containers by name prefix
      const containers = execSync(`docker ps --filter "name=${stackName}" --format "{{.Names}}"`, {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore']
      })
        .trim()
        .split("\n")
        .filter(Boolean)

      if (containers.length === 0) {
        return { exists: false, running: 0, total: 0 }
      }

      // In non-swarm mode, we assume all found containers should be running
      return { exists: true, running: containers.length, total: containers.length }
    }
  } catch (error) {
    return { exists: false, running: 0, total: 0 }
  }
}

export default defineEventHandler(async () => {
  try {
    const workspaceBase = process.env.WORKSPACE_BASE || "/var/apps"
    
    // Read all project directories (excluding swarm-config itself)
    const projectDirs = readdirSync(workspaceBase, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== "swarm-config")
      .map(dirent => dirent.name)

    const services = projectDirs
      .filter(name => {
        const serviceFile = join(workspaceBase, name, "service.ts")
        return existsSync(serviceFile)
      })
      .map(name => {
        // Check if there's a docker-compose.yaml file
        const composeFile = join(workspaceBase, name, "docker-compose.yaml")
        const hasStack = existsSync(composeFile)
        
        // Get Docker status only if docker-compose.yaml exists
        const dockerStatus = hasStack ? getDockerStatus(name) : { exists: false, running: 0, total: 0 }
        
        return {
          name,
          file: "service.ts",
          hasStack,
          dockerStack: dockerStatus,
        }
      })

    return services
  } catch (error) {
    console.error("Error reading services:", error)
    throw createError({ statusCode: 500, message: "Failed to read services" })
  }
})
