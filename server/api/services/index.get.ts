import type { Repository } from "~/types"
import { listRepositories, gitRepoExists } from "~/server/utils/gitRepo"
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
      const workspaceDir = `${config.workspaceBase}/${repo.owner}/${repo.name}`
      const projectDir = join(config.workspaceBase, repo.owner, repo.name)
      
      const hasStack = findComposeConfig(projectDir) !== undefined
      const dockerStack = hasStack
        ? getDockerStatus(repo.name)
        : { exists: false, running: 0, total: 0 }

      let kongRoute: string
      if (swarmActive) {
        kongRoute = `https://${repo.hostname || `${repo.name}.${config.domain}`}`
      } else {
        const port = getServicePort(projectDir, repo.name)
        kongRoute = `http://localhost:${port}`
      }

      const gitRepoPath = `${config.gitRepoBase}/${repo.owner}/${repo.name}.git`
      const repoExists = gitRepoExists(gitRepoPath)
      
      console.log(`Checking repo: ${gitRepoPath} -> ${repoExists}`)

      return {
        name: repo.name,
        path: gitRepoPath,
        workspaceDir,
        gitUrl: `git@${config.domain}:${repo.owner}/${repo.name}`,
        kongRoute,
        createdAt: repo.createdAt,
        owner: repo.owner,
        gitRepoExists: repoExists,
        hasStack,
        dockerStack,
      }
    })
  } catch (error) {
    console.error("Failed to list services:", error)
    return []
  }
})
