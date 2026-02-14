import { existsSync } from "fs"
import { join } from "path"

/**
 * Finds kong.yaml or project.json in project root
 */
export function findKongConfig(projectDir: string): string | undefined {
  const projectJsonPath = join(projectDir, "project.json")
  if (existsSync(projectJsonPath)) return projectJsonPath
  
  const kongYamlPath = join(projectDir, "kong.yaml")
  return existsSync(kongYamlPath) ? kongYamlPath : undefined
}

/**
 * Finds compose.yaml in project root
 */
export function findComposeConfig(projectDir: string): string | undefined {
  const path = join(projectDir, "compose.yaml")
  return existsSync(path) ? path : undefined
}

/**
 * Finds kong.yaml for a project by name (uses runtime config for workspace base)
 */
export function findKongConfigByName(projectName: string): string | undefined {
  const config = useRuntimeConfig()
  const projectDir = join(config.workspaceBase, projectName)
  return findKongConfig(projectDir)
}

/**
 * Finds docker-compose.yaml for a project by name (uses runtime config for workspace base)
 */
export function findComposeConfigByName(projectName: string): string | undefined {
  const config = useRuntimeConfig()
  const projectDir = join(config.workspaceBase, projectName)
  return findComposeConfig(projectDir)
}

/**
 * Gets the project directory path from project name using runtime config
 */
export function getProjectDir(projectName: string): string {
  const config = useRuntimeConfig()
  return join(config.workspaceBase, projectName)
}
