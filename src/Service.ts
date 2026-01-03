import { getDomains, registerDomain } from "./DomainRegister.js"
import { createPlugin, type Plugin, type PluginFactory } from "./Plugin.js"
import yaml from "js-yaml"

interface Route {
  name: string
  hosts: string[]
  paths: string[]
  preserve_host: boolean
  strip_path: boolean
  protocols: string[]
  plugins?: Plugin[]
}

type RouteOptions = Partial<Route>

const defaultRouteOptions: RouteOptions = {
  preserve_host: true,
  strip_path: false,
  protocols: ["https"],
}

type RouteFactory = {
  get(): Route
}

function createService(
  name: string,
  url: string,
  routeFactories: RouteFactory[],
  pluginFactories?: PluginFactory[],
): ServiceFactory {
  return {
    get() {
      const routes = routeFactories.map(route => route.get())
      const plugins = pluginFactories?.map(plugin => plugin.get()) || []
      return { name, url, routes, plugins }
    },
  }
}

type ServiceFactory = {
  get(): {
    name: string
    url: string
    routes: Route[]
    plugins: Plugin[]
  }
}

function createRoute(name: string, options?: RouteOptions, pluginFactories?: PluginFactory[]) {
  options?.hosts?.forEach(registerDomain)

  return {
    get() {
      const plugins = pluginFactories?.map(plugin => plugin.get())
      return { ...defaultRouteOptions, name, ...options, plugins } as Route
    },
  }
}

export function acmeService(): ServiceFactory {
  const route = {
    get() {
      return {
        ...defaultRouteOptions,
        name: "acme-dummy",
        protocols: ["http"],
        paths: ["/.well-known/acme-challenge"],
        hosts: getDomains(),
      } as Route
    },
  }

  return createService("acme-dummy", "http://127.0.0.1:65535", [route])
}

export function createStack(stack: string) {
  const services = [] as ServiceFactory[]

  return {
    addService(service: string, port: number) {
      const name = stack + "_" + service
      const url = "http://" + name + ":" + port
      const routes = [] as RouteFactory[]
      const plugins = [] as PluginFactory[]
      let routeCounter = 0

      const result = {
        addRoute(host: string, options?: RouteOptions, routePlugins?: PluginFactory[]) {
          options = { ...options, hosts: (options?.hosts || []).concat(host) }
          // Generate unique route name by appending counter if multiple routes exist
          const routeName = routeCounter > 0 ? `${name}_${routeCounter}` : name
          routeCounter++
          routes.push(createRoute(routeName, options, routePlugins))
          return result
        },

        addRedirection(host: string, dest: string, options?: RouteOptions, code = 301) {
          const access = [
            `local path = kong.request.get_path_with_query(); if path:sub(-1) == '/' then path = path:sub(1, -2); end; kong.response.exit(${code}, 'Page moved - redirecting to ${dest}' .. path, {['Location'] = '${dest}' .. path})`,
          ]
          const preFunction = createPlugin("pre-function", { access })
          options = {
            ...options,
            hosts: (options?.hosts || []).concat(host),
          }
          const routeName = `${stack}_${host.replaceAll(".", "-")}_redirect`
          const route = createRoute(routeName, options, [preFunction])
          routes.push(route)
          return result
        },

        addPlugin(name: string, config?: Record<string, unknown>) {
          plugins.push(createPlugin(name, config))
          return result
        },

        get() {
          return createService(name, url, routes, plugins).get()
        },
      }

      services.push(result)

      return result
    },

    get() {
      return services.map(service => service.get())
    },

    toYAML() {
      const servicesData = services.map(service => service.get())

      return yaml.dump({
        services: servicesData.map(s => ({
          name: s.name,
          url: s.url,
        })),
        routes: servicesData.flatMap(s =>
          s.routes.map(r => ({
            name: r.name,
            hosts: r.hosts,
            paths: r.paths,
            protocols: r.protocols,
            preserve_host: r.preserve_host,
            strip_path: r.strip_path,
            service: s.name,
            ...(r.plugins && r.plugins.length > 0 ? { plugins: r.plugins } : {}),
          })),
        ),
        ...(servicesData.some(s => s.plugins.length > 0)
          ? {
              plugins: servicesData.flatMap(s => s.plugins),
            }
          : {}),
      })
    },
  }
}
