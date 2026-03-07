import { execSync } from "child_process"
import { requireAuth } from "~/server/utils/auth"
import { isDevMode, getWorkspaceDir } from "~/server/utils/workspace"
import { getLatestCommitFromRepo } from "~/server/utils/gitRepo"

export default defineEventHandler(async event => {
  const auth = await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const workspaceDir = getWorkspaceDir(name, auth.username)
    const version = getLatestCommitFromRepo(name, auth.username)

    console.log(`Starting service ${name} with VERSION=${version}`)

    if (isDevMode()) {
      execSync(`VERSION=${version} docker compose -p ${name} up -d`, {
        encoding: "utf-8",
        cwd: workspaceDir,
      })
    } else {
      execSync(`VERSION=${version} docker stack deploy -c ${workspaceDir}/compose.yaml ${name}`, {
        encoding: "utf-8",
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error starting service:", error)
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to start service",
    })
  }
})
