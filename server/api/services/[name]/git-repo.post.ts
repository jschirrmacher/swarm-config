import { createGitRepository } from "~/server/utils/gitRepo"
import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Repository name required" })
  }

  try {
    const auth = await requireAuth(event)
    const repoPath = await createGitRepository(name, auth.username, config.gitRepoBase)

    return {
      success: true,
      path: repoPath,
      gitUrl: `git@${config.domain}:${auth.username}/${name}`,
    }
  } catch (error) {
    console.error("Failed to create git repository:", error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to create git repository",
    })
  }
})
