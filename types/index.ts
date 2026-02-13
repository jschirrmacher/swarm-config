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
