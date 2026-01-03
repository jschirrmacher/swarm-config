import type { RouteLocationNormalized } from "vue-router"

// Auth middleware - redirect to login if not authenticated
export default defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
  // Skip middleware for login page
  if (to.path === "/login") {
    return
  }

  // Skip auth check in development mode
  if (process.env.NODE_ENV === "development") {
    return
  }

  // Check if user is authenticated (client-side only)
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("swarm-config-token")
    if (!token) {
      return navigateTo("/login")
    }
  }
})
