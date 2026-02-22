import type { Repository } from "~/types"
import { listAllProjects, getRepoStatus } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"
import { join } from "node:path"
import { existsSync } from "node:fs"
import { getDockerStatus, isSwarmActive } from "~/server/utils/dockerStatus"
import { findComposeConfig } from "~/server/utils/findConfigFiles"
import { getServicePort } from "~/server/utils/getServicePort"
import { getWorkspaceDir, getSwarmConfig } from "~/server/utils/workspace"

export default defineEventHandler(async (event): Promise<Repository[]> => {
  try {
    const auth = await requireAuth(event)
    const repos = await listAllProjects(auth.username)
    const swarmActive = isSwarmActive()
    const config = getSwarmConfig()

    return repos.map(repo => {
      const workspaceDir = getWorkspaceDir(repo.name, repo.owner)
      const projectDir = getWorkspaceDir(repo.name, repo.owner)
      
      const repoStatus = getRepoStatus(repo.name, repo.owner)
      
      const hasWorkspace = existsSync(projectDir)
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

      return {
        name: repo.name,
        path: repoStatus.gitRepoPath,
        workspaceDir,
        gitUrl: repoStatus.gitUrl,
        kongRoute,
        createdAt: repo.createdAt,
        owner: repo.owner,
        gitRepoExists: repoStatus.hasGitRepo,
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
