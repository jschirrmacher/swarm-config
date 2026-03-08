import { chownSync, chmodSync } from "node:fs"
import { execSync } from "node:child_process"

const GIT_UID = parseInt(process.env.GIT_UID || "1000", 10)
const DOCKER_GID = parseInt(process.env.DOCKER_GID || "999", 10)

export function setGitOwnership(path: string) {
  try {
    chownSync(path, GIT_UID, DOCKER_GID)
    chmodSync(path, 0o775)
  } catch (error) {
    console.error(`Failed to set git ownership for ${path}:`, error)
  }
}

export function setUserOwnership(path: string, username: string) {
  try {
    const result = execSync(`id -u ${username} 2>/dev/null || echo "1000"`)
    const uid = parseInt(result.toString().trim(), 10)

    chownSync(path, uid, DOCKER_GID)
    chmodSync(path, 0o775)
  } catch (error) {
    console.error(`Failed to set user ownership for ${path}:`, error)
    try {
      execSync(`chgrp -R ${DOCKER_GID} "${path}"`)
      execSync(`chmod -R g+rwX "${path}"`)
    } catch {}
  }
}

export function setGroupInheritance(path: string) {
  try {
    chmodSync(path, 0o2775)
  } catch (error) {
    console.error(`Failed to set setgid bit for ${path}:`, error)
  }
}

export function setSharedPermissions(path: string) {
  try {
    execSync(`chgrp -R ${DOCKER_GID} "${path}"`)
    execSync(`chmod -R g+rwX "${path}"`)
    execSync(`find "${path}" -type d -exec chmod g+s {} \\;`)
  } catch (error) {
    console.error(`Failed to set shared permissions for ${path}:`, error)
  }
}

export function setPermissions(path: string, mode: number) {
  try {
    chmodSync(path, mode)
  } catch (error) {
    console.error(`Failed to chmod ${path}:`, error)
  }
}
