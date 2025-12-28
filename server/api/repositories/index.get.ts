import type { Repository } from "~/types"
import { listRepositories, getCurrentUser } from "~/server/utils/gitRepo"

export default defineEventHandler(async (event): Promise<Repository[]> => {
  const config = useRuntimeConfig()

  try {
    const owner = await getCurrentUser(event)
    const repos = await listRepositories(owner, config.gitRepoBase, config.workspaceBase)

    return repos.map(repo => ({
      name: repo.name,
      path: `${config.gitRepoBase}/${owner}/${repo.name}.git`,
      workspaceDir: `${config.workspaceBase}/${owner}/${repo.name}`,
      gitUrl: `git@${config.domain}:${config.gitRepoBase}/${owner}/${repo.name}.git`,
      kongRoute: repo.enableKong ? `https://${repo.name}.${config.domain}` : "",
      createdAt: repo.createdAt,
      owner: repo.owner,
    }))
  } catch (error) {
    console.error("Failed to list repositories:", error)
    return []
  }
})
