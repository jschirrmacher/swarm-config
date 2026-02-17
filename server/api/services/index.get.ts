import type { Repository } from "~/types"
import { listAllProjects, gitRepoExists } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"
import { join } from "path"
import { existsSync } from "fs"
import { getDockerStatus, isSwarmActive } from "~/server/utils/dockerStatus"
import { findComposeConfig } from "~/server/utils/findConfigFiles"
import { getServicePort } from "~/server/utils/getServicePort"

export default defineEventHandler(async (event): Promise<Repository[]> => {
  const config = useRuntimeConfig()

  try {
    const auth = await requireAuth(event)
    const repos = await listAllProjects(auth.username, config.workspaceBase, config.gitRepoBase)
    const swarmActive = isSwarmActive()
    const isSingleUserMode = process.env.NODE_ENV === 'development'

    return repos.map(repo => {
      // Build paths based on mode
      const workspaceDir = isSingleUserMode 
        ? `${config.workspaceBase}/${repo.name}`
        : `${config.workspaceBase}/${repo.owner}/${repo.name}`
      const projectDir = isSingleUserMode
        ? join(config.workspaceBase, repo.name)
        : join(config.workspaceBase, repo.owner, repo.name)
      const gitRepoPath = isSingleUserMode
        ? `${config.gitRepoBase}/${repo.name}.git`
        : `${config.gitRepoBase}/${repo.owner}/${repo.name}.git`
      
      // Check what exists
      const hasWorkspace = existsSync(projectDir)
      const hasGitRepo = gitRepoExists(gitRepoPath)
      const hasStack = hasWorkspace && findComposeConfig(projectDir) !== undefined
      
      // Check Docker status
      const dockerStack = getDockerStatus(repo.name)

      let kongRoute: string
      if (swarmActive) {
        kongRoute = `https://${repo.hostname || `${repo.name}.${config.domain}`}`
      } else {
        const port = hasWorkspace ? getServicePort(projectDir, repo.name) : repo.port
        kongRoute = `http://localhost:${port}`
      }

      const gitUrl = isSingleUserMode
        ? `git@${config.domain}:${repo.name}`
        : `git@${config.domain}:${repo.owner}/${repo.name}`

      return {
        name: repo.name,
        path: gitRepoPath,
        workspaceDir,
        gitUrl,
        kongRoute,
        createdAt: repo.createdAt,
        owner: repo.owner,
        gitRepoExists: hasGitRepo,
        hasWorkspace,
        hasStack,
        dockerStack,
      }
    })
  } catch (error) {
    console.error("Failed to list services:", error)
    return []
  }
})
