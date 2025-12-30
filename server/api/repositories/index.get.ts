import type { Repository } from "~/types"
import { listRepositories } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"

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

      return {
        name: repo.name,
        path: `${config.gitRepoBase}/${owner}/${repo.name}.git`,
        workspaceDir,
        gitUrl: `git@${config.domain}:${config.gitRepoBase}/${owner}/${repo.name}.git`,
        kongRoute: `https://${repo.name}.${config.domain}`,
        createdAt: repo.createdAt,
        owner: repo.owner,
      }
    })
  } catch (error) {
    console.error("Failed to list repositories:", error)
    return []
  }
})
