import type { Repository } from "~/types"
import { listRepositories } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"
import { existsSync } from "fs"
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
    console.log(`[getDockerStatus] Stack: ${stackName}, Swarm active: ${swarmActive}`)

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

      console.log(`[getDockerStatus] All stacks:`, stacks)
      console.log(`[getDockerStatus] Looking for '${stackName}', found: ${stacks.includes(stackName)}`)

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

      console.log(`[getDockerStatus] Services replicas for ${stackName}:`, services)

      let totalRunning = 0
      let totalReplicas = 0

      for (const replica of services) {
        const match = replica.match(/(\d+)\/(\d+)/)
        if (match) {
          totalRunning += parseInt(match[1]!, 10)
          totalReplicas += parseInt(match[2]!, 10)
        }
      }

      console.log(`[getDockerStatus] Result: running=${totalRunning}, total=${totalReplicas}`)
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
    console.error(`[getDockerStatus] Error checking status for ${stackName}:`, error)
    return { exists: false, running: 0, total: 0 }
  }
}

export default defineEventHandler(async (event): Promise<Repository[]> => {
  const config = useRuntimeConfig()

  try {
    const owner = await requireAuth(event)
    const repos = await listRepositories(owner, config.workspaceBase)
    const activeStacksDir = join(process.cwd(), "config", "stacks", "active")

    return repos.map(repo => {
      // For legacy apps, use the old structure (no username subdirectory)
      const isLegacy = (repo as any).legacy === true
      const workspaceDir = isLegacy
        ? `${config.workspaceBase}/${repo.name}`
        : `${config.workspaceBase}/${owner}/${repo.name}`

      // Check if there's a corresponding active stack file
      const stackFile = join(activeStacksDir, `${repo.name}.yaml`)
      const hasStack = existsSync(stackFile)
      
      // Get Docker status only if stack file exists in active directory
      const dockerStack = hasStack ? getDockerStatus(repo.name) : { exists: false, running: 0, total: 0 }

      return {
        name: repo.name,
        path: `${config.gitRepoBase}/${owner}/${repo.name}.git`,
        workspaceDir,
        gitUrl: `git@${config.domain}:${config.gitRepoBase}/${owner}/${repo.name}.git`,
        kongRoute: `https://${repo.name}.${config.domain}`,
        createdAt: repo.createdAt,
        owner: repo.owner,
        hasStack,
        dockerStack,
      }
    })
  } catch (error) {
    console.error("Failed to list repositories:", error)
    return []
  }
})
