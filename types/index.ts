export interface Repository {
  name: string
  path: string
  workspaceDir: string
  gitUrl: string
  kongRoute: string
  createdAt: string
  owner: string
  hasStack?: boolean
  dockerStack?: {
    exists: boolean
    running: number
    total: number
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

// Service Configuration Types
export interface ServiceConfig {
  services: ServiceDefinition[]
}

export interface ServiceDefinition {
  name: string
  port: number
  routes: RouteDefinition[]
  plugins: PluginDefinition[]
  redirections?: RedirectionDefinition[]
}

export interface RouteDefinition {
  host: string
  options?: RouteOptions
  plugins?: PluginDefinition[]
}

export interface RouteOptions {
  name?: string
  paths?: string[]
  preserve_host?: boolean
  strip_path?: boolean
  https_redirect_status_code?: number
  protocols?: string[]
}

export interface PluginDefinition {
  name: string
  config?: Record<string, unknown>
}

export interface RedirectionDefinition {
  host: string
  destination: string
  code?: number
  options?: RouteOptions
}
