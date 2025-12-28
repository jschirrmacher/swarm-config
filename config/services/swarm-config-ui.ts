import { createStack } from "../../src/Service.js"
import { getDomain } from "../../src/config.js"

// Swarm Config Web UI with Basic Authentication
// Accessible to all users with SSH keys (automatically generated consumers)
const domain = getDomain()

export default createStack("swarm-config-ui")
  .addService("swarm-config-ui", 3000)
  .addRoute(`config.${domain}`)
  .addPlugin("basic-auth")
