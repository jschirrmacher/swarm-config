import { exec } from "node:child_process"
import { promisify } from "node:util"
import { access, mkdir, writeFile, readFile, readdir } from "node:fs/promises"
import { accessSync, constants } from "node:fs"
import { join } from "node:path"
import { getCookie, getHeader } from "h3"
import { findKongConfig } from "./findConfigFiles"

const execAsync = promisify(exec)

export function gitRepoExists(repoPath: string): boolean {
  try {
    const headPath = join(repoPath, "HEAD")
    accessSync(headPath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

function getSwarmConfigDir(): string {
  // The Nuxt server runs from the swarm-config project directory
  return process.cwd()
}

export interface RepoConfig {
  name: string
  port: number
  owner: string
  createdAt: string
  gitUrl?: string
  hostname?: string
  routes?: RouteConfig[]
  plugins?: PluginConfig[]
}

export interface RouteConfig {
  paths?: string[]
  stripPath?: boolean
  preserveHost?: boolean
}

export interface PluginConfig {
  name: string
  config?: Record<string, any>
}

export async function createGitRepository(
  name: string,
  owner: string,
  baseDir: string,
): Promise<string> {
  const repoPath = join(baseDir, owner, `${name}.git`)

  // Check if repository already exists
  try {
    await access(repoPath, constants.R_OK)
    throw new Error(`Repository ${owner}/${name}.git already exists`)
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      throw error
    }
  }

  // Create namespace directory with team group permissions
  await mkdir(join(baseDir, owner), { recursive: true, mode: 0o775 })

  // Initialize bare git repository
  await execAsync(`git init --bare "${repoPath}"`)
  
  // Set group permissions
  await execAsync(`chmod -R g+rwX "${repoPath}"`)

  // Link post-receive hook from swarm-config
  const hookSource = join(getSwarmConfigDir(), "hooks", "post-receive")
  const hookDest = join(repoPath, "hooks", "post-receive")

  try {
    await access(hookSource, constants.R_OK)
    await execAsync(`ln -sf "${hookSource}" "${hookDest}"`)
    await execAsync(`chmod +x "${hookSource}"`)
  } catch (error) {
    console.warn("Could not link post-receive hook:", error)
  }

  return `${owner}/${name}.git`
}

export async function createWorkspace(
  name: string,
  owner: string,
  baseDir: string,
  config: RepoConfig,
): Promise<string> {
  const workspaceDir = join(baseDir, owner, name)

  // Create workspace directory structure
  await mkdir(workspaceDir, { recursive: true, mode: 0o755 })
  await mkdir(join(workspaceDir, "data"), { recursive: true, mode: 0o755 })

  // Create .env file
  const envContent = `# Environment variables for ${name}
NODE_ENV=production
PORT=${config.port}
`
  await writeFile(join(workspaceDir, ".env"), envContent, { mode: 0o600 })

  // Create project metadata file
  const metadata = {
    name,
    owner,
    port: config.port,
    createdAt: config.createdAt,
    routes: config.routes || [
      {
        paths: ["/"],
        stripPath: false,
        preserveHost: true,
      },
    ],
    plugins: config.plugins || [],
  }
  
  await writeFile(
    join(workspaceDir, "project.json"),
    JSON.stringify(metadata, null, 2),
    { mode: 0o644 }
  )

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
    const configs: RepoConfig[] = []
    
    // Scan all namespace directories
    const rootEntries = await readdir(workspaceBaseDir, { withFileTypes: true })
    
    for (const entry of rootEntries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (entry.name.startsWith(".")) continue
      
      const entryPath = join(workspaceBaseDir, entry.name)
      
      // Check if this is a namespace directory (contains subdirectories with project.json)
      try {
        const subEntries = await readdir(entryPath, { withFileTypes: true })
        let hasProjects = false
        
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() && !subEntry.isSymbolicLink()) continue
          if (subEntry.name.startsWith(".")) continue
          
          const projectDir = join(entryPath, subEntry.name)
          const config = await loadProjectConfig(projectDir, subEntry.name, entry.name)
          if (config) {
            configs.push(config)
            hasProjects = true
          }
        }
        
        // If no projects found in subdirectories, check if entry itself is a legacy project
        if (!hasProjects) {
          const config = await loadProjectConfig(entryPath, entry.name, owner)
          if (config && config.owner === owner) {
            configs.push(config)
          }
        }
      } catch {
        // Not a directory or access denied - skip
      }
    }

    return configs
  } catch (error) {
    console.warn("Failed to search for repositories:", error)
    return []
  }
}

async function loadProjectConfig(projectDir: string, name: string, owner: string): Promise<RepoConfig | null> {
  const projectJsonPath = join(projectDir, "project.json")
  const kongYamlPath = join(projectDir, "kong.yaml")
  
  // Prefer project.json
  if (await fileExists(projectJsonPath)) {
    try {
      const content = await readFile(projectJsonPath, "utf-8")
      const metadata = JSON.parse(content)
      return {
        name,
        port: metadata.port || 3000,
        owner: metadata.owner || owner,
        createdAt: metadata.createdAt || new Date().toISOString(),
        gitUrl: metadata.gitUrl,
        hostname: metadata.hostname,
        routes: metadata.routes,
        plugins: metadata.plugins,
      }
    } catch {
      return null
    }
  }
  
  // Fallback to kong.yaml (legacy)
  if (await fileExists(kongYamlPath)) {
    return {
      name,
      port: 3000,
      owner,
      createdAt: new Date().toISOString(),
    }
  }
  
  return null
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
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

  // Check if hostname is already taken by another project
  const domain = process.env.DOMAIN || "example.com"
  const hostname = `${name}.${domain}`
  
  const workspaceBase = process.env.WORKSPACE_BASE ?? "/var/apps"
  const isHostnameTaken = await checkHostnameExists(hostname, workspaceBase)
  
  if (isHostnameTaken) {
    return {
      valid: false,
      error: `Hostname ${hostname} is already in use by another project`,
    }
  }

  return { valid: true }
}

async function checkHostnameExists(hostname: string, workspaceBase: string): Promise<boolean> {
  try {
    const entries = await readdir(workspaceBase, { withFileTypes: true })
    
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      
      const entryPath = join(workspaceBase, entry.name)
      
      // Check direct kong.yaml
      if (await checkKongYamlForHostname(join(entryPath, "kong.yaml"), hostname)) {
        return true
      }
      
      // Check namespace subdirectories
      try {
        const subEntries = await readdir(entryPath, { withFileTypes: true })
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() && !subEntry.isSymbolicLink()) continue
          
          if (await checkKongYamlForHostname(join(entryPath, subEntry.name, "kong.yaml"), hostname)) {
            return true
          }
        }
      } catch {
        // Not a directory - skip
      }
    }
    
    return false
  } catch {
    return false
  }
}

async function checkKongYamlForHostname(kongYamlPath: string, hostname: string): Promise<boolean> {
  try {
    await access(kongYamlPath, constants.R_OK)
    const content = await readFile(kongYamlPath, "utf-8")
    
    // Simple string search - more efficient than full YAML parsing
    return content.includes(hostname)
  } catch {
    return false
  }
}
