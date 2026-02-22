import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { SwarmConfig, ProjectConfig } from "~/types"

export function isDevMode() {
  return process.env.NODE_ENV === "development"
}

export function getSwarmConfig(): SwarmConfig {
  const config = useRuntimeConfig()
  return {
    workspaceBase: config.workspaceBase,
    gitRepoBase: config.gitRepoBase,
    domain: config.domain,
  }
}

export function getWorkspaceDir(projectName: string, owner: string) {
  const config = getSwarmConfig()
  return isDevMode()
    ? join(config.workspaceBase, projectName)
    : join(config.workspaceBase, owner, projectName)
}

export function getProjectConfig(projectDir: string) {
  const projectJsonPath = join(projectDir, "project.json")
  
  if (!existsSync(projectJsonPath)) {
    return null
  }
  
  try {
    return JSON.parse(readFileSync(projectJsonPath, "utf-8")) as ProjectConfig
  } catch {
    return null
  }
}

export function readProjectConfig(projectName: string, owner: string) {
  const projectDir = getWorkspaceDir(projectName, owner)
  return getProjectConfig(projectDir)
}

function validateProjectData(data: any): data is ProjectConfig {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.owner === "string" &&
    typeof data.port === "number" &&
    typeof data.createdAt === "string" &&
    (data.env === undefined || typeof data.env === "object")
  )
}

function sanitizeProjectData(data: ProjectConfig): ProjectConfig {
  const sanitized: ProjectConfig = {
    owner: data.owner,
    port: data.port,
    createdAt: data.createdAt,
  }

  if (data.gitUrl !== undefined) sanitized.gitUrl = data.gitUrl
  if (data.hostname !== undefined) sanitized.hostname = data.hostname
  if (data.routes !== undefined) sanitized.routes = data.routes
  if (data.plugins !== undefined) sanitized.plugins = data.plugins
  if (data.env !== undefined) sanitized.env = data.env
  if (data.metadata !== undefined) sanitized.metadata = data.metadata

  return sanitized
}

export function writeProjectJson(projectName: string, data: ProjectConfig) {
  if (!validateProjectData(data)) {
    throw new Error("Invalid project data")
  }
  
  const projectDir = getWorkspaceDir(projectName, data.owner)
  const projectJsonPath = join(projectDir, "project.json")
  writeFileSync(projectJsonPath, JSON.stringify(sanitizeProjectData(data), null, 2))
}
