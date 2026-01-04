/**
 * Helper function to run a setup step with consistent logging and error handling
 * Automatically outputs STEP:START and STEP:COMPLETE markers
 */
export async function runStep(
  stepId: string,
  title: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  console.log(`[STEP:START:${stepId}]`)
  console.log(title)

  try {
    await fn()
    console.log("")
    console.log(`[STEP:COMPLETE:${stepId}]`)
  } catch (error) {
    console.error(`❌ Step failed: ${error instanceof Error ? error.message : String(error)}`)
    console.log("")
    console.log(`[STEP:COMPLETE:${stepId}]`)
    process.exit(1)
  }
}
