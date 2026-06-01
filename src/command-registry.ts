import { dispatchUpdate } from './cli/dispatch.ts'
import { createComponent, deleteComponent, listComponents } from './components/repository.ts'
import { parseCommandOptions } from './command-options.ts'
import { readComponent } from './read.ts'
import type { ReadOptions } from './types.ts'
import { validateComponent } from './validation.ts'

export type StarfrontCommandContext = {
  cwd?: string
}

export type StarfrontCommandDefinition = {
  signature: string
  mcpTool: string
  description: string
  match(args: string[]): boolean
  execute(args: string[], context: StarfrontCommandContext): Promise<unknown>
}

function componentAction(args: string[], action: string): boolean {
  return args[0] === 'ui' && args[1] === 'component' && args[2] === action
}

export const starfrontCommandRegistry: StarfrontCommandDefinition[] = [
  {
    signature: 'starfront ui component list',
    mcpTool: 'ui_component_list',
    description: 'List Starfront UI components in the active project.',
    match: args => (args[0] === 'ui' && args[1] === 'list') || componentAction(args, 'list'),
    execute: async (_args, { cwd }) => listComponents(cwd),
  },
  {
    signature: 'starfront ui component create <name> [template]',
    mcpTool: 'ui_component_create',
    description: 'Create a component from the default, minimal, or button template.',
    match: args => componentAction(args, 'create') && Boolean(args[3]),
    execute: async (args, { cwd }) => createComponent(args[3], args[4] ?? 'default', cwd),
  },
  {
    signature: 'starfront ui component read <name> [section]',
    mcpTool: 'ui_component_read',
    description: 'Read all component data or one section such as props, root, styles, or validation.',
    match: args => componentAction(args, 'read') && Boolean(args[3]),
    execute: async (args, { cwd }) => {
      const { positional, options } = parseCommandOptions(args.slice(4))

      return readComponent(args[3], positional[0] ?? 'all', { ...(options as ReadOptions), cwd })
    },
  },
  {
    signature: 'starfront ui component update <name> <tokens...> [options]',
    mcpTool: 'ui_component_update',
    description:
      'Run the update grammar used by the CLI. MCP clients should prefer specific tools for props, root append/delete, and styles. Supports root delete --node <pathOrName>; bem block/element/modifier style delete; and style declarations replace duplicate properties instead of appending duplicates.',
    match: args => componentAction(args, 'update') && Boolean(args[3]),
    execute: async (args, { cwd }) => {
      const { positional, options } = parseCommandOptions(args.slice(4))

      return dispatchUpdate(args[3], positional, options, cwd)
    },
  },
  {
    signature: 'starfront ui component validate <name>',
    mcpTool: 'ui_component_validate',
    description: 'Validate required files, root markup, style imports, and BEM style coverage.',
    match: args => componentAction(args, 'validate') && Boolean(args[3]),
    execute: async (args, { cwd }) => validateComponent(args[3], cwd),
  },
  {
    signature: 'starfront ui component delete <name>',
    mcpTool: 'ui_component_delete',
    description: 'Delete a component directory.',
    match: args => componentAction(args, 'delete') && Boolean(args[3]),
    execute: async (args, { cwd }) => deleteComponent(args[3], cwd),
  },
]

export const starfrontCommandReference = starfrontCommandRegistry.map(({ signature, mcpTool, description }) => ({
  command: signature,
  mcpTool,
  description,
}))
