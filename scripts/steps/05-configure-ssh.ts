#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { runStep } from "../lib/step.js"
import { readFileSync, writeFileSync, appendFileSync } from "fs"

await runStep("05-configure-ssh", "Configuring SSH security...", async () => {
  const usernames = process.env.USERNAMES

  if (!usernames) {
    console.log("⚠️  Skipping SSH security (no team users created)")
    return
  }

  const sshdConfigPath = "/etc/ssh/sshd_config"
  let sshdConfig = readFileSync(sshdConfigPath, "utf-8")

  // Disable root login and password authentication
  sshdConfig = sshdConfig.replace(/^#*PermitRootLogin.*/gm, "PermitRootLogin no")
  sshdConfig = sshdConfig.replace(/^#*PasswordAuthentication.*/gm, "PasswordAuthentication no")

  // Ensure settings are present
  if (!/^PermitRootLogin/m.test(sshdConfig)) {
    sshdConfig += "\n# Security settings added by setup\nPermitRootLogin no\n"
  }

  if (!/^PasswordAuthentication/m.test(sshdConfig)) {
    sshdConfig += "PasswordAuthentication no\n"
  }

  writeFileSync(sshdConfigPath, sshdConfig)

  // Restart SSH
  exec("service ssh restart")

  console.log("✅ SSH security configured")
  console.log("⚠️  IMPORTANT: Test team user SSH access before closing this session!")
})
