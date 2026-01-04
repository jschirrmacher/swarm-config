// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  modules: ["@nuxtjs/color-mode"],

  colorMode: {
    preference: "system", // default value of $colorMode.preference
    fallback: "light", // fallback value if not system preference found
    classSuffix: "", // no suffix for the color-mode class
  },

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
      link: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐳</text></svg>",
        },
      ],
    },
  },
})
