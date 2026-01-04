import { existsSync } from "fs"
import { join } from "path"

interface ConfigFilePaths {
  kong: string[]
  compose: string[]
}

/**
 * Returns possible file paths for kong.yaml and docker-compose.yaml
 * Checks .swarm/ directory first, then project root
 */
export function getConfigFilePaths(projectDir: string): ConfigFilePaths {
  return {
    kong: [join(projectDir, ".swarm", "kong.yaml"), join(projectDir, "kong.yaml")],
    compose: [
      // Check root compose files (recommended)
      join(projectDir, "docker-compose.yml"),
      join(projectDir, "docker-compose.yaml"),
      join(projectDir, "compose.yml"),
      join(projectDir, "compose.yaml"),
    ],
  }
}

/**
 * Finds the first existing file from the given paths
 */
export function findExistingFile(paths: string[]): string | undefined {
  return paths.find(path => existsSync(path))
}

/**
 * Finds kong.yaml in .swarm/ or project root
 */
export function findKongConfig(projectDir: string): string | undefined {
  const paths = getConfigFilePaths(projectDir).kong
  return findExistingFile(paths)
}

/**
 * Finds docker-compose.yaml in .swarm/ or project root
 */
export function findComposeConfig(projectDir: string): string | undefined {
  const paths = getConfigFilePaths(projectDir).compose
  return findExistingFile(paths)
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
