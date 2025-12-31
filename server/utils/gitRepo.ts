import { exec } from "node:child_process"
import { promisify } from "node:util"
import { access, mkdir, writeFile, readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { constants } from "node:fs"
import { getCookie, getHeader } from "h3"

const execAsync = promisify(exec)

function getSwarmConfigDir(): string {
  // The Nuxt server runs from the swarm-config project directory
  return process.cwd()
}

export interface RepoConfig {
  name: string
  port: number
  owner: string
  createdAt: string
}

export async function createGitRepository(
  name: string,
  owner: string,
  baseDir: string,
): Promise<string> {
  const repoPath = join(baseDir, owner, `${name}.git`)

  // Create parent directory if needed
  await mkdir(join(baseDir, owner), { recursive: true, mode: 0o755 })

  // Initialize bare git repository
  await execAsync(`git init --bare "${repoPath}"`)

  // Set ownership to the repository owner (skip group on macOS/dev)
  try {
    await execAsync(`chown -R ${owner} "${repoPath}"`)
  } catch (error) {
    console.warn(`Could not set ownership for ${repoPath}:`, error)
  }

  // Copy post-receive hook from swarm-config
  const hookSource = join(getSwarmConfigDir(), "hooks", "post-receive")
  const hookDest = join(repoPath, "hooks", "post-receive")

  try {
    await access(hookSource, constants.R_OK)
    await execAsync(`cp "${hookSource}" "${hookDest}"`)
    await execAsync(`chmod +x "${hookDest}"`)
  } catch (error) {
    console.warn("Could not copy post-receive hook:", error)
  }

  return repoPath
}

export async function createWorkspace(
  name: string,
  baseDir: string,
  config: RepoConfig,
): Promise<string> {
  const workspaceDir = join(baseDir, name)

  // Create workspace directory structure
  await mkdir(workspaceDir, { recursive: true, mode: 0o755 })
  await mkdir(join(workspaceDir, "data"), { recursive: true, mode: 0o755 })

  // Create .env file
  const envContent = `# Environment variables for ${name}
NODE_ENV=production
PORT=${config.port}
`
  await writeFile(join(workspaceDir, ".env"), envContent, { mode: 0o600 })

  // Save repo config
  const configPath = join(workspaceDir, ".repo-config.json")
  await writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o644 })

  // Create service.ts template
  const domain = process.env.DOMAIN || "example.com"
  const serviceContent = `import { createStack } from "../../../swarm-config/src/Service.js"

export default createStack("${name}")
  .addService("${name}", ${config.port})
  .addRoute("${name}.${domain}")
`
  await writeFile(join(workspaceDir, "service.ts"), serviceContent, { mode: 0o644 })

  // Create docker-compose.yaml template
  const composeContent = `services:
  ${name}:
    image: \${IMAGE_NAME:-${name}:latest}
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "\${PORT:-${config.port}}:${config.port}"
    volumes:
      - ./data:/app/data
    networks:
      - kong-net
    labels:
      - "com.docker.stack.namespace=${name}"

networks:
  kong-net:
    external: true
`
  await writeFile(join(workspaceDir, "docker-compose.yaml"), composeContent, { mode: 0o644 })

  return workspaceDir
}

export async function createKongService(name: string, port: number, domain: string): Promise<void> {
  try {
    const baseUrl = "http://localhost:3000"

    // Generate new Kong config
    const generateResponse = await fetch(`${baseUrl}/api/kong/generate`, {
      method: "POST",
    })
    if (!generateResponse.ok) {
      throw new Error(`Generate failed: ${await generateResponse.text()}`)
    }

    // Reload Kong
    const reloadResponse = await fetch(`${baseUrl}/api/kong/reload`, {
      method: "POST",
    })
    if (!reloadResponse.ok) {
      throw new Error(`Reload failed: ${await reloadResponse.text()}`)
    }
  } catch (error) {
    console.error("Failed to regenerate Kong config:", error)
    throw error
  }
}

export async function listRepositories(
  owner: string,
  workspaceBaseDir: string,
): Promise<RepoConfig[]> {
  try {
    const entries = await readdir(workspaceBaseDir, { withFileTypes: true })
    
    const configPromises = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(async (entry) => {
        const configPath = join(workspaceBaseDir, entry.name, '.repo-config.json')
        
        try {
          await access(configPath, constants.R_OK)
          const content = await readFile(configPath, "utf-8")
          const config = JSON.parse(content) as RepoConfig
          // In dev mode or if no owner specified, return all repos
          // Otherwise filter by owner
          return (!owner || config.owner === owner) ? config : null
        } catch (error) {
          return null
        }
      })

    const configs = await Promise.all(configPromises)
    return configs.filter((config): config is RepoConfig => config !== null)
  } catch (error) {
    console.warn("Failed to search for repositories:", error)
    return []
  }
}

export async function getCurrentUser(event?: any): Promise<string> {
  // Try to get user from Basic Auth header (Kong authentication)
  if (event) {
    try {
      // Kong passes the authenticated username via X-Consumer-Username header
      const username = getHeader(event, "x-consumer-username")
      if (username) {
        return username
      }
    } catch (error) {
      console.warn("Failed to get username from Kong header:", error)
    }

    // Try to get user from JWT token (Argus authentication) as fallback
    try {
      const cookie = getCookie(event, "argus-token")
      if (cookie) {
        const payload = await verifyJWT(cookie)
        if (payload && payload.username) {
          return payload.username
        }
      }
    } catch (error) {
      console.warn("Failed to parse JWT token:", error)
    }
  }

  // Fallback to whoami for development
  try {
    const { stdout } = await execAsync("whoami")
    return stdout.trim()
  } catch (error) {
    return "unknown"
  }
}

async function verifyJWT(token: string): Promise<{ username: string } | null> {
  // Import jwt verification - requires jsonwebtoken package
  try {
    const jwt = await import("jsonwebtoken")
    const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
    const decoded = jwt.verify(token, secret) as any
    return { username: decoded.username }
  } catch (error) {
    return null
  }
}

export async function validateRepoName(name: string): Promise<{ valid: boolean; error?: string }> {
  // Repository name validation
  if (!/^[a-z0-9-]+$/.test(name)) {
    return {
      valid: false,
      error: "Repository name must contain only lowercase letters, numbers, and hyphens",
    }
  }

  if (name.length < 3 || name.length > 50) {
    return {
      valid: false,
      error: "Repository name must be between 3 and 50 characters",
    }
  }

  return { valid: true }
}
