import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { findComposeConfig } from "./findConfigFiles"

/**
 * Gets the actual host port that a container is mapped to
 * by checking the running container's port bindings
 */
function getContainerHostPort(containerName: string): number | null {
  try {
    const portsJson = execSync(
      `docker inspect ${containerName} --format '{{json .NetworkSettings.Ports}}'`,
      { encoding: "utf-8", timeout: 3000, stdio: ["pipe", "pipe", "ignore"] },
    ).trim()

    const ports = JSON.parse(portsJson)

    // Look for any port mapping (e.g., "3000/tcp": [{"HostPort": "3001"}])
    for (const [containerPort, bindings] of Object.entries(ports)) {
      if (bindings && Array.isArray(bindings) && bindings.length > 0) {
        const hostPort = bindings[0]?.HostPort
        if (hostPort) {
          return parseInt(hostPort, 10)
        }
      }
    }
  } catch {
    // Container not running or error reading ports
  }
  return null
}

/**
 * Extracts the port number from a service's configuration
 * Checks docker-compose files and .env files
 * If container is running, checks actual port mapping
 */
export function getServicePort(projectDir: string, serviceName: string): number {
  // First, try to get the actual port from the running container
  const containerPatterns = [
    `${serviceName}-${serviceName}-1`,
    `${serviceName}_${serviceName}_1`,
    serviceName,
  ]

  for (const pattern of containerPatterns) {
    const hostPort = getContainerHostPort(pattern)
    if (hostPort) {
      return hostPort
    }
  }

  // If container is not running, fall back to configuration files
  // Try to read port from .env file
  const envPath = join(projectDir, ".env")
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8")
      const portMatch = envContent.match(/^PORT=(\d+)/m)
      if (portMatch && portMatch[1]) {
        return parseInt(portMatch[1], 10)
      }
    } catch {
      // Ignore errors reading .env
    }
  }

  // Try to read port from docker-compose file
  const composePath = findComposeConfig(projectDir)
  if (composePath) {
    try {
      const composeContent = readFileSync(composePath, "utf-8")
      // Match patterns like "3000:3000" or "${PORT:-3000}:3000"
      const portMatch = composeContent.match(/ports:\s*\n\s*-\s*["']?(?:\$\{PORT:-)?(\d+)/m)
      if (portMatch && portMatch[1]) {
        return parseInt(portMatch[1], 10)
      }
    } catch {
      // Ignore errors reading compose file
    }
  }

  // Default port if nothing found
  return 3000
}
