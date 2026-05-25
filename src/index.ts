#!/usr/bin/env node
import { createProgram } from './cli/program.ts'

export { createProgram } from './cli/program.ts'
export { starfront } from './starfront.ts'

const program = await createProgram()

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
