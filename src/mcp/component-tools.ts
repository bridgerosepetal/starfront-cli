import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { dispatchUpdate } from '../cli/dispatch.ts'
import { cliArgsWithOptions } from '../command-vocabulary.ts'
import { createComponent, deleteComponent, listComponents } from '../components/repository.ts'
import { readComponent } from '../read.ts'
import { validateComponent } from '../validation.ts'
import { uiComponentUpdateOptionsSchema } from './component-tool-schemas.ts'
import { componentUpdateDescription } from './component-update-description.ts'
import { normalizeUpdateOptions } from './component-update-options.ts'
import { registerSpecificUpdateTools } from './component-update-tools.ts'
import { jsonResult, type McpToolContext } from './tool-context.ts'

export function registerComponentTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_list',
    {
      title: 'List Starfront UI components',
      description: 'List Astro UI components from src/shared/ui in the selected project.',
      inputSchema: {
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ projectRoot }) => {
      const activeProjectRoot = context.useProjectRoot(projectRoot)

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: activeProjectRoot,
          tool: 'ui_component_list',
          args: ['ui', 'component', 'list'],
          run: async () => listComponents(activeProjectRoot),
        }),
      )
    },
  )

  registerReadComponentTool(server, context)
  registerWriteComponentTools(server, context)
}

function registerReadComponentTool(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_read',
    {
      title: 'Read Starfront UI component',
      description: 'Read a component model, props, markup, styles, or validation details.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        section: z
          .enum([
            'all',
            'component',
            'files',
            'props',
            'frontmatter',
            'markup',
            'root',
            'styles',
            'style',
            'validation',
          ])
          .optional()
          .describe('Component section to read. Defaults to all.'),
        depth: z.union([z.string(), z.number()]).optional().describe('Limit markup tree depth.'),
        element: z.string().optional().describe('BEM element name or markup path to read.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, section, depth, element }) => {
      const activeProjectRoot = context.useProjectRoot(projectRoot)
      const readSection = section ?? 'all'

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: activeProjectRoot,
          tool: 'ui_component_read',
          args: cliArgsWithOptions(['ui', 'component', 'read', name, readSection], { depth, element }),
          run: async () => readComponent(name, readSection, { cwd: activeProjectRoot, depth, element }),
        }),
      )
    },
  )
}

function registerWriteComponentTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_create',
    {
      title: 'Create Starfront UI component',
      description: 'Create a new Starfront UI component in src/shared/ui.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        template: z.enum(['default', 'minimal', 'button']).optional().describe('Template name. Defaults to default.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, template }) => {
      const activeProjectRoot = context.useProjectRoot(projectRoot)
      const createArgs = ['ui', 'component', 'create', name, ...(template ? [template] : [])]

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: activeProjectRoot,
          tool: 'ui_component_create',
          args: createArgs,
          run: async () => createComponent(name, template ?? 'default', activeProjectRoot),
        }),
      )
    },
  )

  registerUpdateValidateDeleteTools(server, context)
}

function registerUpdateValidateDeleteTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_update',
    {
      title: 'Update Starfront UI component',
      description: componentUpdateDescription,
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        tokens: z
          .array(z.string())
          .describe('Update tokens after the component name, for example ["prop","create","label","string"].'),
        options: uiComponentUpdateOptionsSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, tokens, options }) => {
      const activeProjectRoot = context.useProjectRoot(projectRoot)
      const normalizedOptions = normalizeUpdateOptions(options ?? {})

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: activeProjectRoot,
          tool: 'ui_component_update',
          args: cliArgsWithOptions(['ui', 'component', 'update', name, ...tokens], normalizedOptions),
          run: async () => dispatchUpdate(name, tokens, normalizedOptions, activeProjectRoot),
        }),
      )
    },
  )

  registerSpecificUpdateTools(server, context)

  server.registerTool(
    'ui_component_validate',
    {
      title: 'Validate Starfront UI component',
      description: 'Validate required component files, root markup, style imports, and BEM style coverage.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot }) => {
      const activeProjectRoot = context.useProjectRoot(projectRoot)

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: activeProjectRoot,
          tool: 'ui_component_validate',
          args: ['ui', 'component', 'validate', name],
          run: async () => validateComponent(name, activeProjectRoot),
        }),
      )
    },
  )

  server.registerTool(
    'ui_component_delete',
    {
      title: 'Delete Starfront UI component',
      description: 'Delete a Starfront UI component directory from src/shared/ui.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot }) => {
      return jsonResult(
        await context.commandLogger.record({
          projectRoot: context.useProjectRoot(projectRoot),
          tool: 'ui_component_delete',
          args: ['ui', 'component', 'delete', name],
          run: async () => deleteComponent(name, context.getProjectRoot()),
        }),
      )
    },
  )
}
