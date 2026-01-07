#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { runStep } from "../lib/step.js"
import { existsSync, appendFileSync, readFileSync, createReadStream } from "fs"
import { createInterface } from "readline"

await runStep("09-install-glusterfs", "GlusterFS installation (optional)...", async () => {
  const envPath = "/var/apps/swarm-config/.env"
  let installGlusterFS: string | undefined

  // Check if decision is already saved in .env
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8")
      const match = content.match(/^INSTALL_GLUSTERFS=(.+)$/m)
      if (match) {
        installGlusterFS = match[1]
      }
    } catch {
      // .env exists but no INSTALL_GLUSTERFS
    }
  }

  if (!installGlusterFS) {
    // Check if /dev/tty is available for interactive input
    if (!existsSync("/dev/tty")) {
      console.log("  ⏭️  No terminal available: Skipping GlusterFS installation")
      console.log("  ℹ️  To install later, set INSTALL_GLUSTERFS=true in .env and re-run setup")
      appendFileSync(envPath, "INSTALL_GLUSTERFS=false\n")
      return
    }

    console.log("GlusterFS is needed for multi-node clusters with distributed storage.")
    console.log("For single-node setups, you can skip this.")
    console.log("")

    // Ask user (using /dev/tty for direct terminal access)
    const rl = createInterface({
      input: createReadStream("/dev/tty"),
      output: process.stdout,
    })

    const answer = await new Promise<string>(resolve => {
      rl.question("Do you want to install GlusterFS? (y/N): ", answer => {
        rl.close()
        resolve(answer)
      })
    })

    // Save decision to .env
    if (answer.match(/^[Yy]$/)) {
      appendFileSync(envPath, "INSTALL_GLUSTERFS=true\n")
      installGlusterFS = "true"
    } else {
      appendFileSync(envPath, "INSTALL_GLUSTERFS=false\n")
      installGlusterFS = "false"
    }
  } else {
    console.log(`  Using saved preference from .env: INSTALL_GLUSTERFS=${installGlusterFS}`)
  }

  if (installGlusterFS === "true") {
    console.log("  Installing GlusterFS...")
    exec("apt install -y glusterfs-server")
    exec("systemctl enable glusterd")
    exec("systemctl start glusterd")
    console.log("✅ GlusterFS installed and started")
    console.log("ℹ️  See docs/MULTI-NODE-SETUP.md for cluster configuration")
  } else {
    console.log("⏭️  Skipping GlusterFS installation")
  }
})
