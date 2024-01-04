import { createStack } from "./Service.js"

export function createMonitoringStack(stackName: string, domain: string) {
  const monitoringStack = createStack(stackName)
  monitoringStack
    .addService("prometheus", 9090)
    .addRoute("prometheus." + domain)
    .addPlugin("basic-auth")
  monitoringStack.addService("grafana", 3000).addRoute("grafana." + domain)
  return monitoringStack
}
