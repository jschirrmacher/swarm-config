import type { ServiceConfig } from "../../types"

/**
 * Generates TypeScript code from a ServiceConfig structure
 */
export function generateServiceCode(stackName: string, config: ServiceConfig): string {
  const lines: string[] = []
  
  // Add imports
  lines.push(`import { createStack } from "../../src/Service.js"`)
  
  // Check if we need getDomain import (simplified check)
  const needsDomain = config.services.some(svc => 
    svc.routes.some(route => route.host.includes('${domain}') || route.host.includes('getDomain'))
  )
  
  if (needsDomain) {
    lines.push(`import { getDomain } from "../../src/config.js"`)
    lines.push(``)
    lines.push(`const domain = getDomain()`)
  }
  
  // Check if we need createPlugin import
  const needsPlugins = config.services.some(svc => 
    svc.routes.some(route => route.plugins && route.plugins.length > 0)
  )
  
  if (needsPlugins) {
    lines.push(`import { createPlugin } from "../../src/Plugin.js"`)
  }
  
  lines.push(``)
  lines.push(`export default createStack("${stackName}")`)
  
  // Generate services
  for (const service of config.services) {
    lines.push(`  .addService("${service.name}", ${service.port})`)
    
    // Generate routes
    for (const route of service.routes) {
      const parts = [`"${route.host}"`]
      
      // Add options if present
      if (route.options && Object.keys(route.options).length > 0) {
        const opts: string[] = []
        
        if (route.options.name) opts.push(`name: "${route.options.name}"`)
        if (route.options.paths) {
          const pathsArray = Array.isArray(route.options.paths)
            ? route.options.paths
            : (route.options.paths as string).split(',').map((p: string) => p.trim())
          opts.push(`paths: [${pathsArray.map((p: string) => `"${p}"`).join(', ')}]`)
        }
        if (route.options.strip_path !== undefined) opts.push(`strip_path: ${route.options.strip_path}`)
        if (route.options.preserve_host !== undefined) opts.push(`preserve_host: ${route.options.preserve_host}`)
        if (route.options.https_redirect_status_code) opts.push(`https_redirect_status_code: ${route.options.https_redirect_status_code}`)
        if (route.options.protocols) {
          opts.push(`protocols: [${route.options.protocols.map(p => `"${p}"`).join(', ')}]`)
        }
        
        if (opts.length > 0) {
          parts.push(`{ ${opts.join(', ')} }`)
        }
      }
      
      // Add route plugins
      if (route.plugins && route.plugins.length > 0) {
        const pluginCalls = route.plugins.map(p => {
          if (p.config && Object.keys(p.config).length > 0) {
            return `createPlugin("${p.name}", ${JSON.stringify(p.config)})`
          }
          return `createPlugin("${p.name}")`
        })
        parts.push(`[${pluginCalls.join(', ')}]`)
      }
      
      lines.push(`  .addRoute(${parts.join(', ')})`)
    }
    
    // Generate service-level plugins
    for (const plugin of service.plugins || []) {
      if (plugin.config && Object.keys(plugin.config).length > 0) {
        lines.push(`  .addPlugin("${plugin.name}", ${JSON.stringify(plugin.config)})`)
      } else {
        lines.push(`  .addPlugin("${plugin.name}")`)
      }
    }
  }
  
  lines.push(``)
  
  return lines.join('\n')
}
