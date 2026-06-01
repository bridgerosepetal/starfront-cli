import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { normalizeProjectRoot } from '../utils/project.ts'

import { registerComponentTools } from './component-tools.ts'
import { createMcpCommandLogger } from './log.ts'
import { registerMetaTools } from './meta-tools.ts'

type StarfrontMcpOptions = {
  projectRoot?: string
}

function resolveProjectRoot(projectRoot?: string): string {
  return normalizeProjectRoot(projectRoot ?? process.env.STARFRONT_PROJECT_ROOT ?? process.cwd())
}

export async function startStarfrontMcpServer(options: StarfrontMcpOptions = {}): Promise<void> {
  let projectRoot = resolveProjectRoot(options.projectRoot)
  const commandLogger = createMcpCommandLogger()
  const context = {
    getProjectRoot: () => projectRoot,
    setProjectRoot: (nextProjectRoot: string) => {
      projectRoot = nextProjectRoot
    },
    useProjectRoot: (nextProjectRoot?: string) => {
      if (!nextProjectRoot) {
        return projectRoot
      }

      const resolvedProjectRoot = normalizeProjectRoot(nextProjectRoot)

      if (!existsSync(resolvedProjectRoot)) {
        throw new Error(`Project directory does not exist: ${resolvedProjectRoot}`)
      }

      projectRoot = resolvedProjectRoot
      return projectRoot
    },
    commandLogger,
  }

  const server = new McpServer({
    name: '@bridgerosepetal/starfront-cli',
    version: '0.4.0',
  })

  registerMetaTools(server, context)
  registerComponentTools(server, context)

  await server.connect(new StdioServerTransport())
}

export function parseMcpArgs(args: string[]): StarfrontMcpOptions {
  const options: StarfrontMcpOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if ((arg === '--project' || arg === '--cwd') && args[index + 1]) {
      options.projectRoot = path.resolve(args[index + 1])
      index += 1
    }
  }

  return options
}
