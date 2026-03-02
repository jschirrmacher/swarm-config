export interface Repository {
  name: string
  path: string
  workspaceDir: string
  gitUrl: string | null
  kongRoute: string
  createdAt: string
  owner: string
  gitRepoExists: boolean
  hasWorkspace?: boolean
  hasStack?: boolean
  dockerStack?: {
    exists: boolean
    running: number
    total: number
  }
}

export interface SwarmConfig {
  workspaceBase: string
  gitRepoBase: string
  domain: string
  techEmail: string
}

export interface ProjectConfig {
  owner: string
  port: number
  createdAt: string
  gitUrl?: string
  hostname?: string
  serviceName?: string
  maxUploadSize?: number
  routes?: Array<{
    paths: string[]
    stripPath?: boolean
    preserveHost?: boolean
  }>
  plugins?: any[]
  env?: Record<string, string>
  metadata?: {
    hostname?: string
    [key: string]: any
  }
}

export interface CreateRepoRequest {
  name: string
  port?: number
}

export interface CreateRepoResponse {
  success: boolean
  repository?: Repository
  error?: string
}
