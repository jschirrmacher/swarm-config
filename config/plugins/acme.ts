import { createAcmePlugin, createRedisStorage } from "../../src/Plugin.js"

// ACME Plugin for automatic SSL/TLS certificate management via Let's Encrypt
// Edit the email address to match your domain ownership
export default createAcmePlugin("tech@example.com", [createRedisStorage()])
