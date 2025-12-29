import { createStack } from "../../src/Service.js"
import { getDomain } from "../../src/config.js"
import { createPlugin } from "../../src/Plugin.js"

// Swarm Config Web UI
// Main UI is public, only /api/auth/login requires Basic Auth (handled by Kong)
// All other API endpoints are protected by JWT (handled in backend)
const domain = getDomain()

export default createStack("swarm-config")
  .addService("ui", 3000)
  .addRoute(`config.${domain}`)
  .addRoute(`config.${domain}`, { paths: ["/api/auth/login"] }, [createPlugin("basic-auth")])
