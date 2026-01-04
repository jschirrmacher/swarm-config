#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { runStep } from "../lib/step.js"

await runStep("03-install-firewall", "Configuring UFW Firewall...", async () => {
  exec("apt install -y ufw")

  // Allow necessary ports
  exec("ufw allow ssh")
  exec("ufw allow http")
  exec("ufw allow https")

  // Enable firewall (non-interactive)
  exec("ufw --force enable")

  console.log("✅ UFW Firewall configured (ports: 22, 80, 443)")
})
