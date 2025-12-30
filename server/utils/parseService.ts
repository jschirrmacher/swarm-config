import type { ServiceConfig, ServiceDefinition, RouteDefinition, PluginDefinition } from "../../types"

/**
 * Parses a TypeScript service configuration file and extracts its structure
 * Returns null if the file uses a special format (like acme.ts) that cannot be parsed
 */
export function parseServiceConfig(content: string): ServiceConfig | null {
  // Check if this is a special case (doesn't use createStack)
  if (!content.includes('createStack(')) {
    return null
  }

  const services: ServiceDefinition[] = []
  
  try {
    // Extract stack name from createStack("name")
    const stackMatch = content.match(/createStack\("([^"]+)"\)/)
    if (!stackMatch) return null
    const stackName = stackMatch[1]

    // Find all .addService() calls
    const serviceRegex = /\.addService\("([^"]+)",\s*(\d+)\)/g
    let serviceMatch
    
    while ((serviceMatch = serviceRegex.exec(content)) !== null) {
      const serviceName = serviceMatch[1]
      const port = parseInt(serviceMatch[2]!, 10) ?? 3000
      
      // Find the section of code for this service
      const serviceStartIndex = serviceMatch.index
      // Find next .addService or end of export
      const nextServiceIndex = content.indexOf('.addService', serviceStartIndex + 1)
      const endIndex = nextServiceIndex > 0 ? nextServiceIndex : content.length
      const serviceSection = content.substring(serviceStartIndex, endIndex)
      
      const routes = parseRoutes(serviceSection)
      const plugins = parsePlugins(serviceSection)
      
      services.push({
        name: serviceName ?? "",
        port,
        routes,
        plugins
      })
    }

    return { services }
  } catch (error) {
    console.error('Error parsing service config:', error)
    return null
  }
}

function parseRoutes(section: string): RouteDefinition[] {
  const routes: RouteDefinition[] = []
  
  // Match .addRoute with either "host", 'host', or `host` (template strings)
  const routeRegex = /\.addRoute\(["'`]([^"'`]+)["'`](?:,\s*\{([^}]*)\})?(?:,\s*\[([^\]]*)\])?\)/g
  let routeMatch
  
  while ((routeMatch = routeRegex.exec(section)) !== null) {
    const host = routeMatch[1]!
    const optionsStr = routeMatch[2]
    const pluginsStr = routeMatch[3]
    
    const route: RouteDefinition = { 
      host,
      options: {} // Always initialize options
    }
    
    // Parse options if present
    if (optionsStr) {
      route.options = parseRouteOptions(optionsStr)
    }
    
    // Parse route-specific plugins if present
    if (pluginsStr) {
      route.plugins = parsePluginArray(pluginsStr)
    }
    
    routes.push(route)
  }
  
  return routes
}

function parseRouteOptions(optionsStr: string): any {
  const options: any = {}
  
  // Parse name
  const nameMatch = optionsStr.match(/name:\s*"([^"]+)"/)
  if (nameMatch) options.name = nameMatch[1]
  
  // Parse paths array
  const pathsMatch = optionsStr.match(/paths:\s*\[([^\]]+)\]/)
  if (pathsMatch?.[1]) {
    options.paths = pathsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, ''))
  }
  
  // Parse strip_path
  const stripPathMatch = optionsStr.match(/strip_path:\s*(true|false)/)
  if (stripPathMatch) options.strip_path = stripPathMatch[1] === 'true'
  
  // Parse preserve_host
  const preserveHostMatch = optionsStr.match(/preserve_host:\s*(true|false)/)
  if (preserveHostMatch) options.preserve_host = preserveHostMatch[1] === 'true'
  
  // Parse https_redirect_status_code
  const redirectMatch = optionsStr.match(/https_redirect_status_code:\s*(\d+)/)
  if (redirectMatch?.[1]) options.https_redirect_status_code = parseInt(redirectMatch[1], 10)
  
  // Parse protocols array
  const protocolsMatch = optionsStr.match(/protocols:\s*\[([^\]]+)\]/)
  if (protocolsMatch?.[1]) {
    options.protocols = protocolsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, ''))
  }
  
  return options
}

function parsePlugins(section: string): PluginDefinition[] {
  const plugins: PluginDefinition[] = []
  
  // Match .addPlugin("name", { config })
  const pluginRegex = /\.addPlugin\("([^"]+)"(?:,\s*\{([^}]*)\})?\)/g
  let pluginMatch
  
  while ((pluginMatch = pluginRegex.exec(section)) !== null) {
    if (!pluginMatch[1]) continue
    
    const plugin: PluginDefinition = {
      name: pluginMatch[1]
    }
    
    if (pluginMatch[2]) {
      // Simple config parsing - would need to be more robust for complex objects
      plugin.config = {}
    }
    
    plugins.push(plugin)
  }
  
  return plugins
}

function parsePluginArray(pluginsStr: string): PluginDefinition[] {
  const plugins: PluginDefinition[] = []
  
  // Match createPlugin with either "name", 'name' or `name`
  const pluginRegex = /createPlugin\(["'`]([^"'`]+)["'`](?:,\s*\{([^}]*)\})?\)/g
  let pluginMatch
  
  while ((pluginMatch = pluginRegex.exec(pluginsStr)) !== null) {
    if (!pluginMatch[1]) continue
    
    const plugin: PluginDefinition = {
      name: pluginMatch[1]
    }
    
    if (pluginMatch[2]) {
      plugin.config = {}
    }
    
    plugins.push(plugin)
  }
  
  return plugins
}
