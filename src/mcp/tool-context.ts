import { existsSync } from 'node:fs'
import path from 'node:path'

import { getUiRoot, relative } from '../utils/project.ts'

import type { McpCommandLogger } from './log.ts'

export type McpToolContext = {
  getProjectRoot(): string
  setProjectRoot(projectRoot: string): void
  useProjectRoot(projectRoot?: string): string
  commandLogger: McpCommandLogger
}

export function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

export function projectState(projectRoot: string) {
  const uiRoot = getUiRoot(projectRoot)

  return {
    projectRoot,
    exists: existsSync(projectRoot),
    uiRoot,
    uiRootExists: existsSync(uiRoot),
    uiRootRelative: relative(projectRoot, uiRoot),
    commandLog: path.join(projectRoot, '.starfront', 'mcp.log'),
  }
}
