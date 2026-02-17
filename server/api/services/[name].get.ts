import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { findKongConfigByName, findComposeConfigByName } from "../../utils/findConfigFiles"
import { requireAuth } from "~/server/utils/auth"
import { gitRepoExists } from "~/server/utils/gitRepo"
import { execSync } from "child_process"

export default defineEventHandler(async event => {
  const auth = await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const config = useRuntimeConfig()
    const isSingleUserMode = process.env.NODE_ENV === 'development'
    
    // Get project.json for metadata
    const workspaceDir = isSingleUserMode
      ? join(config.workspaceBase, name)
      : join(config.workspaceBase, auth.username, name)
    const projectJsonPath = join(workspaceDir, 'project.json')
    
    let projectData: any = {}
    if (existsSync(projectJsonPath)) {
      projectData = JSON.parse(readFileSync(projectJsonPath, 'utf-8'))
    }

    // Get Docker service status
    let status = 'unknown'
    let replicas = 'N/A'
    let version = projectData.version || 'N/A'
    
    try {
      const serviceInfo = execSync(`docker service inspect ${name} --format '{{.Spec.Mode.Replicated.Replicas}}'`, { encoding: 'utf-8' }).trim()
      replicas = serviceInfo || '0'
      status = parseInt(replicas) > 0 ? 'running' : 'stopped'
    } catch {
      status = 'not deployed'
    }

    // Get environment variables (only for owner)
    let env: Record<string, string> = {}
    if (projectData.owner === auth.username && projectData.env) {
      env = projectData.env
    }

    // Check Git repository
    const gitRepoPath = isSingleUserMode
      ? join(config.gitRepoBase, `${name}.git`)
      : join(config.gitRepoBase, auth.username, `${name}.git`)
    const hasGitRepo = gitRepoExists(gitRepoPath)
    
    const gitUrl = isSingleUserMode
      ? `git@${config.domain}:${name}`
      : `git@${config.domain}:${auth.username}/${name}`

    return {
      name,
      owner: projectData.owner || auth.username,
      status,
      replicas,
      version,
      createdAt: projectData.createdAt,
      gitUrl: hasGitRepo ? gitUrl : null,
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
