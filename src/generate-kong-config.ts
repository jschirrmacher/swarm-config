import { writeFile } from "fs/promises"
import { resolve } from "path"
import { dump } from "js-yaml"
import { consumers, plugins, services } from "../config.js"

const config = {
  _format_version: "3.0",
  _transform: true,

  services: services.flatMap(service => service.get()),
  plugins: plugins.map(plugin => plugin.get()),
  consumers: consumers.map(c => ({ username: c.username })),
  basicauth_credentials: consumers,
}

await writeFile(resolve(process.cwd(), "generated", "kong.yaml"), dump(config))
