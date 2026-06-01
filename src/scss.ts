import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { CssSyntaxError } from 'postcss'

const require = createRequire(import.meta.url)
let loadedSassParser: typeof import('sass-parser') | undefined

function sassParser(): typeof import('sass-parser') {
  loadedSassParser ??= require('sass-parser') as typeof import('sass-parser')

  return loadedSassParser
}

export function assertScssBalancedBraces(style: string): void {
  try {
    sassParser().scss.parse(style)
  } catch (error) {
    if (error instanceof CssSyntaxError) {
      const reason = error.reason.toLowerCase()

      if (reason.includes('unexpected }')) {
        throw new Error(`Invalid SCSS: unexpected closing brace at ${error.line}:${error.column}`)
      }

      throw new Error(`Invalid SCSS: ${error.reason} at ${error.line}:${error.column}`)
    }

    if (error instanceof Error) {
      const location = error.message.match(/\s-\s(\d+):(\d+)\s+root stylesheet/)
      const line = location?.[1]
      const column = location?.[2]

      if (error.message.toLowerCase().includes('unmatched "}"') && line && column) {
        throw new Error(`Invalid SCSS: unexpected closing brace at ${line}:${column}`)
      }

      throw new Error(`Invalid SCSS: ${error.message}`)
    }

    throw new Error(`Invalid SCSS: ${String(error)}`)
  }
}

export async function writeScssFile(path: string, style: string): Promise<void> {
  assertScssBalancedBraces(style)
  await writeFile(path, style)
}
