import { getSetupSteps } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  return getSetupSteps()
})
