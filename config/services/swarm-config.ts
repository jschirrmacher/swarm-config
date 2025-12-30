import { createStack } from "../../src/Service.js"
import { getDomain } from "../../src/config.js"
import { createPlugin } from "../../src/Plugin.js"

const domain = getDomain()

export default createStack("swarm-config")
  .addService("ui", 3000)
  .addRoute(`config.${domain}`, { name: "swarm-config-base", paths: ["/"] })
  .addRoute(`config.${domain}`, { name: "swarm-config-auth", paths: ["/api/auth/login"] }, [
    createPlugin("basic-auth"),
  ])
