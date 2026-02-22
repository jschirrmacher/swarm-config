import { chownSync, chmodSync } from "node:fs"
import { execSync } from "node:child_process"

const GIT_UID = parseInt(process.env.GIT_UID || "1000", 10)
const DOCKER_GID = parseInt(process.env.DOCKER_GID || "999", 10)

export function setGitOwnership(path: string) {
  try {
    chownSync(path, GIT_UID, DOCKER_GID)
  } catch (error) {
    console.error(`Failed to chown ${path}:`, error)
  }
}

export function setUserOwnership(path: string, username: string) {
  try {
    execSync(`chown ${username}:${username} ${path}`)
  } catch (error) {
    console.error(`Failed to chown ${path} to ${username}:`, error)
  }
}

export function setPermissions(path: string, mode: number) {
  try {
    chmodSync(path, mode)
  } catch (error) {
    console.error(`Failed to chmod ${path}:`, error)
  }
}
