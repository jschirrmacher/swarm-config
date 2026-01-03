// Debug endpoint to check environment variables
export default defineEventHandler(() => {
  const config = useRuntimeConfig()

  return {
    runtimeConfig: {
      gitRepoBase: config.gitRepoBase,
      workspaceBase: config.workspaceBase,
      domain: config.domain,
    },
    processEnv: {
      GIT_REPO_BASE: process.env.GIT_REPO_BASE,
      WORKSPACE_BASE: process.env.WORKSPACE_BASE,
      DOMAIN: process.env.DOMAIN,
      NUXT_DOMAIN: process.env.NUXT_DOMAIN,
    },
  }
})
