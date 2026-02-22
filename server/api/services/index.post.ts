import type { CreateRepoRequest, CreateRepoResponse } from "~/types"
import {
  createGitRepository,
  createWorkspace,
  validateRepoName,
  type RepoConfig,
} from "~/server/utils/gitRepo"
import { reloadKongConfig } from "~/server/utils/kongConfig"
import { requireAuth } from "~/server/utils/auth"
import { getSwarmConfig } from "~/server/utils/workspace"

export default defineEventHandler(async (event): Promise<CreateRepoResponse> => {
  const body = await readBody<CreateRepoRequest>(event)

  // Validate input
  if (!body.name) {
    return {
      success: false,
      error: "Repository name is required",
    }
  }

  const validation = await validateRepoName(body.name)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    }
  }

  try {
    const auth = await requireAuth(event)
    const config = getSwarmConfig()
    const port = body.port || 3000

    const repoConfig: RepoConfig = {
      name: body.name,
      port,
      owner: auth.username,
      createdAt: new Date().toISOString(),
    }

    const repoPath = await createGitRepository(body.name, auth.username)

    const workspaceDir = await createWorkspace(body.name, auth.username, repoConfig)

    // Reload Kong configuration
    await reloadKongConfig()

    return {
      success: true,
      repository: {
        name: body.name,
        path: repoPath,
        workspaceDir,
        gitUrl: `git@${config.domain}:${repoPath}`,
        kongRoute: `https://${body.name}.${config.domain}`,
        createdAt: repoConfig.createdAt,
        owner: auth.username,
        gitRepoExists: true,
      },
    }
  } catch (error) {
    console.error("Failed to create repository:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repository",
    }
  }
})
