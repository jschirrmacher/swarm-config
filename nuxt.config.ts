// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  srcDir: ".",
  rootDir: ".",
  buildDir: ".nuxt",

  nitro: {
    preset: "node-server",
    output: {
      dir: ".output",
    },
  },

  runtimeConfig: {
    // Server-side environment variables
    gitRepoBase: process.env.GIT_REPO_BASE || "/home",
    workspaceBase: process.env.WORKSPACE_BASE || "/var/apps",
    domain: process.env.DOMAIN || "example.com",

    public: {
      // Client-side environment variables
      apiBase: process.env.API_BASE || "/api",
    },
  },

  app: {
    head: {
      title: "Swarm Config - Repository Management",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Self-service repository management for Docker Swarm deployments",
        },
      ],
    },
  },
})
