#!/usr/bin/env node
import { docker, networkExists } from "../lib/docker.js"
import { runStep } from "../lib/step.js"

await runStep("06-create-network", "Creating Kong network...", async () => {
  if (networkExists("kong-net")) {
    console.log("✅ kong-net network already exists")
  } else {
    docker("network create --scope=swarm --attachable -d overlay kong-net")
    console.log("✅ kong-net network created")
  }
})
