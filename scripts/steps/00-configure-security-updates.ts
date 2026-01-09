#!/usr/bin/env node
import { exec } from "../lib/docker.js"
import { runStep } from "../lib/step.js"
import { writeFileSync } from "fs"

await runStep(
  "00-configure-security-updates",
  "Configuring automatic security updates...",
  async () => {
    exec("apt update")
    exec("apt install -y unattended-upgrades")

    const unattendedUpgradesConfig = `// Automatically upgrade packages from these origins
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESMApps:\${distro_codename}-apps-security";
    "\${distro_id}ESM:\${distro_codename}-infra-security";
};

// List of packages to not update (blacklist)
Unattended-Upgrade::Package-Blacklist {
    // Exclude Docker packages from automatic updates (should be managed manually)
    "docker-ce";
    "docker-ce-cli";
    "containerd.io";
};

// Automatically reboot WITHOUT CONFIRMATION if required
// after a kernel update
Unattended-Upgrade::Automatic-Reboot "true";

// Reboot at specific time (2:00 AM)
Unattended-Upgrade::Automatic-Reboot-Time "02:00";

// Do automatic removal of unused kernel packages
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";

// Remove unused dependencies
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// Send email notifications (if mail is configured)
// Unattended-Upgrade::Mail "root";

// Enable logging
Unattended-Upgrade::SyslogEnable "true";
Unattended-Upgrade::SyslogFacility "daemon";
`

    writeFileSync("/etc/apt/apt.conf.d/50unattended-upgrades", unattendedUpgradesConfig)

    const autoUpgradesConfig = `APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
`

    writeFileSync("/etc/apt/apt.conf.d/20auto-upgrades", autoUpgradesConfig)

    console.log("✓ Automatic security updates configured")
    console.log("  • Security updates will be installed daily")
    console.log("  • System will auto-reboot at 2:00 AM if required")
    console.log("  • Docker packages excluded (manual management recommended)")
  },
)
