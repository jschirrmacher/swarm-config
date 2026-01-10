import getSteps from "./getSteps.js"
import runSetup from "./runSetup.js"
import { setupRegistry } from "./registry.js"

import configureSecurityUpdates from "./00-configure-security-updates.js"
import getDomain from "./01-get-domain.js"
import installDocker from "./02-install-docker.js"
import installFirewall from "./03-install-firewall.js"
import createUsers from "./04-create-users.js"
import configureSsh from "./05-configure-ssh.js"
import createNetwork from "./06-create-network.js"
import setupHostManagerToken from "./06.5-setup-host-manager-token.js"
import installMsmtp from "./06.7-install-msmtp.js"
import deployKong from "./07-deploy-kong.js"
import deployWebui from "./08-deploy-webui.js"
import installGlusterFs from "./09-install-glusterfs.js"
import prepareApps from "./10-prepare-apps.js"

setupRegistry.register(configureSecurityUpdates)
setupRegistry.register(getDomain)
setupRegistry.register(installDocker)
setupRegistry.register(installFirewall)
setupRegistry.register(createUsers)
setupRegistry.register(configureSsh)
setupRegistry.register(createNetwork)
setupRegistry.register(setupHostManagerToken)
setupRegistry.register(installMsmtp)
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
