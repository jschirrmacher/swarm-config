import { Express, Request, Response, RequestHandler } from "express"

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

export type Handler = (req: Request) => Promise<unknown>
export type StreamingHandler = (req: Request) => AsyncGenerator<string>

export type CommandRegistrar = (
  app: Express,
  authenticate: RequestHandler,
  jsonParser: RequestHandler,
) => void

export function defineCommand(
  description: string,
  method: Method,
  path: string,
  handler: Handler,
): CommandRegistrar {
  return (app: Express, authenticate: RequestHandler, jsonParser: RequestHandler) => {
    const routeMethod = method.toLowerCase() as Lowercase<Method>

    app[routeMethod](path, authenticate, jsonParser, async (req: Request, res: Response) => {
      console.log(`[${new Date().toISOString()}] ${method} ${path} - ${description}`)
      try {
        const result = await handler(req)
        res.json(result)
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ${method} ${path} error:`, error)
        const message = error instanceof Error ? error.message : String(error)
        res.status(500).json({ success: false, error: message })
      }
    })
  }
}

export function defineStreamingCommand(
  description: string,
  method: Method,
  path: string,
  handler: StreamingHandler,
): CommandRegistrar {
  return (app: Express, authenticate: RequestHandler, jsonParser: RequestHandler) => {
    const routeMethod = method.toLowerCase() as Lowercase<Method>

    app[routeMethod](path, authenticate, jsonParser, async (req: Request, res: Response) => {
      console.log(`[${new Date().toISOString()}] ${method} ${path} - ${description}`)

      res.set("Content-Type", "text/event-stream")
      res.set("Cache-Control", "no-cache")
      res.set("Connection", "keep-alive")

      try {
        for await (const chunk of handler(req)) {
          res.write(chunk)
        }
        res.end()
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ${method} ${path} error:`, error)
        const message = error instanceof Error ? error.message : String(error)
        res.write(`data: Error: ${message}\n\n`)
        res.end()
      }
    })
  }
}
