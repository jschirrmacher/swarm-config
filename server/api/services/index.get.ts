import type { Repository } from "~/types"
import { listRepositories } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"
import { join } from "path"
import { getDockerStatus, isSwarmActive } from "~/server/utils/dockerStatus"
import { findComposeConfig } from "~/server/utils/findConfigFiles"
import { getServicePort } from "~/server/utils/getServicePort"

export default defineEventHandler(async (event): Promise<Repository[]> => {
  const config = useRuntimeConfig()

  try {
    const owner = await requireAuth(event)
    const repos = await listRepositories(owner, config.workspaceBase)
    const swarmActive = isSwarmActive()

    return repos.map(repo => {
      // For legacy apps, use the old structure (no username subdirectory)
      const isLegacy = (repo as any).legacy === true
      const workspaceDir = isLegacy
        ? `${config.workspaceBase}/${repo.name}`
        : `${config.workspaceBase}/${owner}/${repo.name}`

      // Check if there's a docker-compose file in the project directory
      const projectDir = join(config.workspaceBase, repo.name)
      const hasStack = findComposeConfig(projectDir) !== undefined

      // Get Docker status only if docker-compose.yaml exists
      const dockerStack = hasStack
        ? getDockerStatus(repo.name)
        : { exists: false, running: 0, total: 0 }

      // Generate kongRoute: use localhost with port in local dev, domain in production
      let kongRoute: string
      if (swarmActive) {
        // Production with Swarm: use the configured domain
        kongRoute = `https://${repo.name}.${config.domain}`
      } else {
        // Local development: use localhost with the service's port
        const port = getServicePort(projectDir, repo.name)
        kongRoute = `http://localhost:${port}`
      }

      return {
        name: repo.name,
        path: `${config.gitRepoBase}/${owner}/${repo.name}.git`,
        workspaceDir,
        gitUrl: `git@${config.domain}:${config.gitRepoBase}/${owner}/${repo.name}.git`,
        kongRoute,
        createdAt: repo.createdAt,
        owner: repo.owner,
        hasStack,
        dockerStack,
      }
    })
  } catch (error) {
    console.error("Failed to list services:", error)
    return []
  }
})
