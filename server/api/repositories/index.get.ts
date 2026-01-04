import type { Repository } from "~/types"
import { listRepositories } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"
import { join } from "path"
import { getDockerStatus } from "~/server/utils/dockerStatus"
import { findComposeConfig } from "~/server/utils/findConfigFiles"

export default defineEventHandler(async (event): Promise<Repository[]> => {
  const config = useRuntimeConfig()

  try {
    const owner = await requireAuth(event)
    const repos = await listRepositories(owner, config.workspaceBase)

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
