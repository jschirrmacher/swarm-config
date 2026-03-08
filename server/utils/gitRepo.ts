import { exec as nodeExec, execSync } from "node:child_process"
import { promisify } from "node:util"
import { access, mkdir, writeFile, readFile, readdir } from "node:fs/promises"
import { accessSync, constants, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { exec } from "./exec"
import { isDevMode, getWorkspaceDir, getProjectConfig, getSwarmConfig } from "./workspace"

const execAsync = promisify(nodeExec)

function getGitRepoPath(projectName: string, owner: string) {
  const config = getSwarmConfig()
  return isDevMode()
    ? join(config.gitRepoBase, `${projectName}.git`)
    : join(config.gitRepoBase, owner, `${projectName}.git`)
}

function getGitUrl(projectName: string, owner: string) {
  const config = getSwarmConfig()
  return isDevMode()
    ? `git@${config.domain}:${projectName}`
    : `git@${config.domain}:${owner}/${projectName}`
}

export function gitRepoExists(repoPath: string) {
  try {
    const headPath = join(repoPath, "HEAD")
    accessSync(headPath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export function getGitRemoteFromWorkspace(workspacePath: string) {
  try {
    const gitDir = join(workspacePath, ".git")
    accessSync(gitDir, constants.R_OK)

    const remoteUrl = exec("git remote get-url origin", { cwd: workspacePath })
    return remoteUrl || null
  } catch {
    return null
  }
}

export function getLatestCommitFromRepo(projectName: string, owner: string): string {
  const gitRepoPath = getGitRepoPath(projectName, owner)

  if (!gitRepoExists(gitRepoPath)) {
    console.warn(`Git repository not found at ${gitRepoPath}, using 'latest' as VERSION`)
    return "latest"
  }

  try {
    const commitId = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
      cwd: gitRepoPath,
    }).trim()

    return commitId || "latest"
  } catch (error) {
    console.warn(`Failed to get commit ID from ${gitRepoPath}:`, error)
    return "latest"
  }
}

export function getRepoStatus(projectName: string, owner: string) {
  const workspaceDir = getWorkspaceDir(projectName, owner)

  const gitRepoPath = getGitRepoPath(projectName, owner)

  let hasGitRepo = gitRepoExists(gitRepoPath)
  let gitUrl: string | null = getGitUrl(projectName, owner)

  if (existsSync(workspaceDir)) {
    const remoteUrl = getGitRemoteFromWorkspace(workspaceDir)
    if (remoteUrl) {
      gitUrl = remoteUrl
      hasGitRepo = true
    }
  }

  if (!hasGitRepo) {
    gitUrl = null
  }

  return {
    hasGitRepo,
    gitUrl,
    gitRepoPath,
  }
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

export async function createGitRepository(name: string, owner: string, port: number = 3000) {
  const config = getSwarmConfig()
  const repoPath = getGitRepoPath(name, owner)

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
  const namespaceDir = isDevMode() ? config.gitRepoBase : join(config.gitRepoBase, owner)
  await mkdir(namespaceDir, { recursive: true, mode: 0o775 })

  // Create temporary directory for initial commit
  const tmpDir = join("/tmp", `${name}-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })

  try {
    // Initialize regular git repository in temp dir
    await execAsync(`git init -b main "${tmpDir}"`)
    await execAsync(`git -C "${tmpDir}" config user.name "Swarm Config"`)
    await execAsync(`git -C "${tmpDir}" config user.email "swarm-config@${config.domain}"`)

    // Create initial files
    const readmeContent = `# ${name}

Created by Swarm Config on ${new Date().toISOString()}

## Getting Started

1. Clone this repository
2. Edit \`compose.yaml\`, \`Dockerfile\`, and \`project.json\` as needed
3. Push changes to deploy automatically

## Files

- \`Dockerfile\` - Docker image build instructions
- \`compose.yaml\` - Docker Compose/Swarm configuration
- \`project.json\` - Project metadata and Kong routing configuration
- \`.env\` - Environment variables (not in git)
`

    const dockerfileContent = `FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE ${port}

# Start application
CMD ["node", "index.js"]
`

    const composeContent = `services:
  ${name}:
    image: ${name}:\${VERSION:-latest}
    environment:
      - NODE_ENV=production
      - PORT=${port}
    volumes:
      - ./data:/app/data
    networks:
      - kong-net
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

networks:
  kong-net:
    external: true
`

    const dockerignoreContent = `node_modules
npm-debug.log
.git
.env
data
*.md
.DS_Store
`

    const projectJsonContent = JSON.stringify(
      {
        owner,
        port,
        createdAt: new Date().toISOString(),
        hostname: `${name}.${config.domain}`,
        routes: [
          {
            paths: ["/"],
            protocols: ["https"],
            preserve_host: true,
            strip_path: false,
          },
        ],
      },
      null,
      2,
    )

    await writeFile(join(tmpDir, "README.md"), readmeContent)
    await writeFile(join(tmpDir, "Dockerfile"), dockerfileContent)
    await writeFile(join(tmpDir, "compose.yaml"), composeContent)
    await writeFile(join(tmpDir, ".dockerignore"), dockerignoreContent)
    await writeFile(join(tmpDir, "project.json"), projectJsonContent)
    await writeFile(join(tmpDir, ".gitignore"), "data/\n.env\nnode_modules/\n")

    // Commit initial files
    await execAsync(`git -C "${tmpDir}" add .`)
    await execAsync(`git -C "${tmpDir}" commit -m "Initial commit"`)

    // Clone as bare repository
    await execAsync(`git clone --bare "${tmpDir}" "${repoPath}"`)

    // Set ownership and permissions (use GIT_UID from environment)
    const gitUid = process.env.GIT_UID || "1000"
    const dockerGid = process.env.DOCKER_GID || "999"
    await execAsync(
      `chown -R ${gitUid}:${dockerGid} "${repoPath}" && chmod -R g+rwX "${repoPath}" && find "${repoPath}" -type d -exec chmod g+s {} \\;`,
    )

    // Link post-receive hook (hook is in swarm-config workspace)
    const swarmConfigDir = isDevMode()
      ? config.workspaceBase
      : join(config.workspaceBase, "swarm-config")

    const hookSource = join(swarmConfigDir, "hooks", "post-receive")
    const hookDest = join(repoPath, "hooks", "post-receive")
    await execAsync(`ln -sf "${hookSource}" "${hookDest}" && chmod +x "${hookSource}"`)

    return `${owner}/${name}.git`
  } finally {
    // Cleanup temp directory
    await execAsync(`rm -rf "${tmpDir}"`).catch(() => {})
  }
}

export async function createWorkspace(name: string, owner: string, repoConfig: RepoConfig) {
  const workspaceDir = getWorkspaceDir(name, owner)

  // Create workspace directory structure
  await mkdir(workspaceDir, { recursive: true, mode: 0o755 })
  await mkdir(join(workspaceDir, "data"), { recursive: true, mode: 0o755 })

  // Create .env file
  const envContent = `# Environment variables for ${name}
NODE_ENV=production
PORT=${repoConfig.port}
`
  await writeFile(join(workspaceDir, ".env"), envContent, { mode: 0o600 })

  // Create compose.yaml template
  const composeContent = `services:
  ${name}:
    image: ${name}:\${VERSION:-latest}
    environment:
      - NODE_ENV=production
      - PORT=${repoConfig.port}
    volumes:
      - ./data:/app/data
    networks:
      - kong-net
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

networks:
  kong-net:
    external: true
`
  await writeFile(join(workspaceDir, "compose.yaml"), composeContent, { mode: 0o644 })

  // Create project metadata file
  const metadata = {
    name,
    owner,
    port: repoConfig.port,
    createdAt: repoConfig.createdAt,
    routes: repoConfig.routes || [
      {
        paths: ["/"],
        stripPath: false,
        preserveHost: true,
      },
    ],
    plugins: repoConfig.plugins || [],
  }

  await writeFile(join(workspaceDir, "project.json"), JSON.stringify(metadata, null, 2), {
    mode: 0o644,
  })

  // Set ownership using numeric IDs
  const dockerGid = process.env.DOCKER_GID || "999"
  try {
    let uid = process.env.GIT_UID || "1000"
    try {
      const result = await execAsync(`id -u ${owner}`)
      uid = result.stdout.trim()
    } catch {}

    await execAsync(
      `chown -R ${uid}:${dockerGid} "${workspaceDir}" && chmod -R u+rwX,g+rwX "${workspaceDir}" && find "${workspaceDir}" -type d -exec chmod g+s {} \\;`,
    )
  } catch (error) {
    console.warn(`Could not set ownership for ${workspaceDir}:`, error)
    await execAsync(
      `chgrp -R ${dockerGid} "${workspaceDir}" && chmod -R g+rwX "${workspaceDir}" && find "${workspaceDir}" -type d -exec chmod g+s {} \\;`,
    )
  }

  return workspaceDir
}

export async function listAllProjects(owner: string) {
  const config = getSwarmConfig()
  try {
    const projectMap = new Map<string, RepoConfig>()

    // 1. Scan workspace directories (both flat and owner-based structure)
    const scanDirs = isDevMode()
      ? [config.workspaceBase]
      : [join(config.workspaceBase, owner), config.workspaceBase]

    for (const workspaceScanDir of scanDirs) {
      try {
        const workspaceEntries = await readdir(workspaceScanDir, { withFileTypes: true })

        for (const entry of workspaceEntries) {
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
          if (entry.name.startsWith(".")) continue

          const projectDir = join(workspaceScanDir, entry.name)

          // In flat mode, only include projects that belong to this user or have no owner
          if (workspaceScanDir === config.workspaceBase && !isDevMode()) {
            const projectConfig = getProjectConfig(projectDir)
            if (projectConfig && projectConfig.owner && projectConfig.owner !== owner) {
              continue
            }
          }

          const repoConfig = await loadProjectConfig(projectDir, entry.name, owner)
          if (!projectMap.has(entry.name)) {
            projectMap.set(entry.name, repoConfig)
          }
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.error(`Failed to scan workspace directory ${workspaceScanDir}:`, error.message)
        }
      }
    }

    // 2. Scan git repositories (both flat and owner-based structure)
    const gitScanDirs = isDevMode()
      ? [config.gitRepoBase]
      : [join(config.gitRepoBase, owner), config.gitRepoBase]

    for (const gitScanDir of gitScanDirs) {
      try {
        const gitEntries = await readdir(gitScanDir, { withFileTypes: true })

        for (const entry of gitEntries) {
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
          if (!entry.name.endsWith(".git")) continue

          const projectName = entry.name.replace(/\.git$/, "")

          if (projectName.startsWith(".")) continue
          if (projectMap.has(projectName)) continue

          projectMap.set(projectName, {
            name: projectName,
            port: 3000,
            owner,
            createdAt: new Date().toISOString(),
          })
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.error(`Failed to scan git repository directory ${gitScanDir}:`, error.message)
        }
      }
    }

    return Array.from(projectMap.values())
  } catch (error) {
    console.warn("Failed to search for projects:", error)
    return []
  }
}

async function loadProjectConfig(projectDir: string, name: string, owner: string) {
  const metadata = getProjectConfig(projectDir)

  if (metadata) {
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
  }

  return {
    name,
    port: 3000,
    owner,
    createdAt: new Date().toISOString(),
  }
}

async function fileExists(path: string) {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function validateRepoName(name: string) {
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
  const config = getSwarmConfig()
  const hostname = `${name}.${config.domain}`

  const isHostnameTaken = await checkHostnameExists(hostname, config.workspaceBase)

  if (isHostnameTaken) {
    return {
      valid: false,
      error: `Hostname ${hostname} is already in use by another project`,
    }
  }

  return { valid: true }
}

async function checkHostnameExists(hostname: string, workspaceBase: string) {
  try {
    const entries = await readdir(workspaceBase, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

      const entryPath = join(workspaceBase, entry.name)

      // Check direct project.json
      if (await checkProjectJsonForHostname(join(entryPath, "project.json"), hostname)) {
        return true
      }

      // Check namespace subdirectories
      try {
        const subEntries = await readdir(entryPath, { withFileTypes: true })
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() && !subEntry.isSymbolicLink()) continue

          if (
            await checkProjectJsonForHostname(
              join(entryPath, subEntry.name, "project.json"),
              hostname,
            )
          ) {
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

async function checkProjectJsonForHostname(projectJsonPath: string, hostname: string) {
  try {
    await access(projectJsonPath, constants.R_OK)
    const content = await readFile(projectJsonPath, "utf-8")
    const metadata = JSON.parse(content)
    return metadata.hostname === hostname
  } catch {
    return false
  }
}
