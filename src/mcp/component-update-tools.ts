import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { registerPropTools } from './component-update-prop-tools.ts'
import { registerRootTools } from './component-update-root-tools.ts'
import { registerStyleTools } from './component-update-style-tools.ts'
import type { McpToolContext } from './tool-context.ts'

export function registerSpecificUpdateTools(server: McpServer, context: McpToolContext): void {
  registerPropTools(server, context)
  registerRootTools(server, context)
  registerStyleTools(server, context)
}
