import type { CreateRepoRequest, CreateRepoResponse } from "~/types"
import {
  createGitRepository,
  createWorkspace,
  createKongService,
  getCurrentUser,
  validateRepoName,
  type RepoConfig,
} from "~/server/utils/gitRepo"

export default defineEventHandler(async (event): Promise<CreateRepoResponse> => {
  const config = useRuntimeConfig()
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
    const owner = await getCurrentUser(event)
    const port = body.port || 3000
    const enableKong = body.enableKong !== false

    const repoConfig: RepoConfig = {
      name: body.name,
      port,
      enableKong,
      owner,
      createdAt: new Date().toISOString(),
    }

    // Create Git repository
    const repoPath = await createGitRepository(body.name, owner, config.gitRepoBase)

    // Create workspace
    const workspaceDir = await createWorkspace(body.name, owner, config.workspaceBase, repoConfig)

    // Create Kong service if enabled
    if (enableKong) {
      await createKongService(body.name, port, config.domain)
    }

    return {
      success: true,
      repository: {
        name: body.name,
        path: repoPath,
        workspaceDir,
        gitUrl: `git@${config.domain}:${repoPath}`,
        kongRoute: enableKong ? `https://${body.name}.${config.domain}` : "",
        createdAt: repoConfig.createdAt,
        owner,
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
