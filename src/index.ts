#!/usr/bin/env node
import path from 'node:path'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createProgram } from './cli/program.ts'

export { createProgram } from './cli/program.ts'
export { starfront } from './starfront.ts'
export {
  formatCliCommand,
  runStarfrontCommand,
  starfrontCommandReference,
  starfrontCommandRegistry,
} from './command-vocabulary.ts'

function comparablePath(filePath: string): string {
  try {
    return realpathSync.native(path.resolve(filePath)).toLowerCase()
  } catch {
    return path.resolve(filePath).toLowerCase()
  }
}

const currentFile = comparablePath(fileURLToPath(import.meta.url))
const isCliEntry = process.argv[1] ? comparablePath(process.argv[1]) === currentFile : false

if (isCliEntry) {
  const program = await createProgram()

  program.parseAsync(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
