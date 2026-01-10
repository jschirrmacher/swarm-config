import getSteps from "./getSteps.js"
import runSetup from "./runSetup.js"
import { setupRegistry } from "./registry.js"

import configureSecurityUpdates from "./01-configure-security-updates.js"
import getDomain from "./02-get-domain.js"
import installDocker from "./03-install-docker.js"
import installFirewall from "./04-install-firewall.js"
import createUsers from "./05-create-users.js"
import configureSsh from "./06-configure-ssh.js"
import createNetwork from "./07-create-network.js"
import setupHostManagerToken from "./08-setup-host-manager-token.js"
import installMsmtp from "./09-install-msmtp.js"
import configureSmtp from "./09.5-configure-smtp.js"
import deployKong from "./10-deploy-kong.js"
import deployWebui from "./11-deploy-webui.js"
import installGlusterFs from "./12-install-glusterfs.js"
import prepareApps from "./13-prepare-apps.js"

setupRegistry.register(configureSecurityUpdates)
setupRegistry.register(getDomain)
setupRegistry.register(installDocker)
setupRegistry.register(installFirewall)
setupRegistry.register(createUsers)
setupRegistry.register(configureSsh)
setupRegistry.register(createNetwork)
setupRegistry.register(setupHostManagerToken)
setupRegistry.register(installMsmtp)
setupRegistry.register(configureSmtp)
setupRegistry.register(deployKong)
setupRegistry.register(deployWebui)
setupRegistry.register(installGlusterFs)
setupRegistry.register(prepareApps)

/**
 * Setup command exports
 *
 * Regular commands (GET/POST) are exported here.
 * Individual setup step commands are registered via setupRegistry.
 */
export default [getSteps, runSetup]
