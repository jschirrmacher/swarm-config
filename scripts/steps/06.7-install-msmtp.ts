#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { runStep } from "../lib/step.js"

await runStep("06.7-install-msmtp", "Installing msmtp for email functionality...", async () => {
  try {
    // Check if msmtp is already installed
    try {
      exec("which msmtp")
      console.log("  ✅ msmtp is already installed")
      return
    } catch {
      // Not installed, continue with installation
    }

    console.log("  📦 Setting up repositories...")

    // Detect Ubuntu codename from /etc/os-release
    const codename =
      exec("grep VERSION_CODENAME /etc/os-release | cut -d= -f2", {
        encoding: "utf8",
      }).trim() || "noble"

    // Ensure universe repository is available
    const ubuntuSourcesPath = "/etc/apt/sources.list.d/ubuntu.sources"
    const sourcesListPath = "/etc/apt/sources.list"

    // Check which format is used
    try {
      exec(`test -f ${ubuntuSourcesPath}`)
      // DEB822 format exists - check for universe
      const content = exec(`cat ${ubuntuSourcesPath}`)
      if (!content.includes("universe")) {
        console.log("  Adding universe component to ubuntu.sources...")
        exec(`sed -i 's/Components: main/Components: main universe/' ${ubuntuSourcesPath}`)
      }
    } catch {
      // DEB822 file doesn't exist, check traditional format
      try {
        exec(`test -f ${sourcesListPath}`)
        const content = exec(`cat ${sourcesListPath}`)
        if (content.includes("sources have moved")) {
          // File is just a placeholder, create ubuntu.sources
          console.log("  Creating ubuntu.sources file...")
          exec(`cat > ${ubuntuSourcesPath} << 'EOF'
Types: deb
URIs: http://archive.ubuntu.com/ubuntu/
Suites: ${codename} ${codename}-updates ${codename}-backports
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://security.ubuntu.com/ubuntu/
Suites: ${codename}-security
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF`)
        } else if (!content.includes("universe")) {
          // Traditional format, add universe
          console.log("  Adding universe repositories to sources.list...")
          exec(
            `echo "deb http://archive.ubuntu.com/ubuntu/ ${codename} universe" >> ${sourcesListPath}`,
          )
          exec(
            `echo "deb http://archive.ubuntu.com/ubuntu/ ${codename}-updates universe" >> ${sourcesListPath}`,
          )
        }
      } catch {
        // Neither exists, create ubuntu.sources
        console.log("  Creating ubuntu.sources file...")
        exec(`cat > ${ubuntuSourcesPath} << 'EOF'
Types: deb
URIs: http://archive.ubuntu.com/ubuntu/
Suites: ${codename} ${codename}-updates ${codename}-backports
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://security.ubuntu.com/ubuntu/
Suites: ${codename}-security
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF`)
      }
    }

    // Update package lists
    console.log("  📥 Updating package lists...")
    exec("apt-get update -qq")

    // Install msmtp
    console.log("  📦 Installing msmtp packages...")
    exec("apt-get install -y msmtp msmtp-mta")

    // Verify installation
    const version = exec("msmtp --version").split("\n")[0]
    console.log(`  ✅ ${version} installed successfully`)
    console.log("\n  ℹ️  You can configure SMTP settings later via the Web UI")
  } catch (error: any) {
    console.error("  ❌ Failed to install msmtp:", error.message)
    console.log("  ℹ️  You can configure email manually later via the Web UI")
  }
})
