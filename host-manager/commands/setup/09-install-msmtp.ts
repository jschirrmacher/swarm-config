import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "09-install-msmtp",
  name: "Install msmtp",
  description: "Install msmtp for email functionality",

  async check() {
    try {
      await executeOnHost("which msmtp")
      return true
    } catch {
      return false
    }
  },

  async *execute() {
    yield "📦 Setting up repositories..."

    const codename =
      (await executeOnHost("grep VERSION_CODENAME /etc/os-release | cut -d= -f2")).stdout.trim() ||
      "noble"

    const ubuntuSourcesPath = "/etc/apt/sources.list.d/ubuntu.sources"
    const sourcesListPath = "/etc/apt/sources.list"

    try {
      await executeOnHost(`test -f ${ubuntuSourcesPath}`)
      const content = (await executeOnHost(`cat ${ubuntuSourcesPath}`)).stdout
      if (!content.includes("universe")) {
        yield "Adding universe component to ubuntu.sources..."
        await executeOnHost(
          `sed -i 's/Components: main/Components: main universe/' ${ubuntuSourcesPath}`,
        )
      }
    } catch {
      try {
        await executeOnHost(`test -f ${sourcesListPath}`)
        const content = (await executeOnHost(`cat ${sourcesListPath}`)).stdout
        if (content.includes("sources have moved")) {
          yield "Creating ubuntu.sources file..."
          await executeOnHost(`cat > ${ubuntuSourcesPath} << 'EOF'
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
          yield "Adding universe repositories to sources.list..."
          await executeOnHost(
            `echo "deb http://archive.ubuntu.com/ubuntu/ ${codename} universe" >> ${sourcesListPath}`,
          )
          await executeOnHost(
            `echo "deb http://archive.ubuntu.com/ubuntu/ ${codename}-updates universe" >> ${sourcesListPath}`,
          )
        }
      } catch {
        yield "Creating ubuntu.sources file..."
        await executeOnHost(`cat > ${ubuntuSourcesPath} << 'EOF'
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

    yield "📥 Updating package lists..."
    await executeOnHost("apt-get update -qq")

    yield "📦 Installing msmtp packages..."
    await executeOnHost("DEBIAN_FRONTEND=noninteractive apt-get install -y -qq msmtp msmtp-mta")

    try {
      const versionOutput = await executeOnHost("msmtp --version 2>&1")
      const version = versionOutput.stdout?.split("\n")[0] || "msmtp"
      yield `✅ ${version} installed successfully`
    } catch {
      yield "✅ msmtp installed successfully"
    }

    yield "ℹ️  You can configure SMTP settings later via the Web UI"
    return { success: true }
  },
})
