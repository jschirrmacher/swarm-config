export interface Repository {
  name: string
  path: string
  workspaceDir: string
  gitUrl: string
  kongRoute: string
  createdAt: string
  owner: string
}

export interface CreateRepoRequest {
  name: string
  port?: number
  enableKong?: boolean
}

export interface CreateRepoResponse {
  success: boolean
  repository?: Repository
  error?: string
}
