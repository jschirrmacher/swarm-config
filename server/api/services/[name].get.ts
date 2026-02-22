import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { requireAuth } from "~/server/utils/auth"
import { getRepoStatus } from "~/server/utils/gitRepo"
import { getProjectConfig, getWorkspaceDir } from "~/server/utils/workspace"
import { getDockerStatus } from "~/server/utils/dockerStatus"

export default defineEventHandler(async event => {
  const auth = await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const workspaceDir = getWorkspaceDir(name, auth.username)
    
    let projectData: any = getProjectConfig(workspaceDir) ?? {}

    const dockerStatus = getDockerStatus(name)
    const status = dockerStatus.status || 'unknown'
    const replicas = dockerStatus.replicas || 'N/A'
    const version = projectData.version || 'N/A'

    let env: Record<string, string> = {}
    if (projectData.owner === auth.username && projectData.env) {
      env = projectData.env
    }

    const repoStatus = getRepoStatus(name, auth.username)

    return {
      name,
      owner: projectData.owner || auth.username,
      status,
      replicas,
      version,
      createdAt: projectData.createdAt,
      gitUrl: repoStatus.gitUrl,
      env: projectData.owner === auth.username ? env : undefined
    }
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error
    }
    console.error("Error reading service:", error)
    throw createError({ statusCode: 500, message: "Failed to read service" })
  }
})
