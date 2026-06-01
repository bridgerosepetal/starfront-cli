import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

import { normalizeStarfrontCommandRun, runStarfrontCommand, starfrontCommandReference } from '../command-vocabulary.ts'
import { normalizeProjectRoot } from '../utils/project.ts'

import { jsonResult, type McpToolContext, projectState } from './tool-context.ts'

export function registerMetaTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'command_reference',
    {
      title: 'Starfront command reference',
      description: 'Return the shared CLI/MCP command vocabulary for Starfront tools.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () =>
      jsonResult({
        usage:
          'Use specific ui_component_* tools for normal UI component work. Markup is root: use ui_component_root_append with elementName to add a BEM element node. BEM style is canonical: use ui_component_bem_block_style_declare for block styles, ui_component_bem_element_style_declare for element styles, and ui_component_bem_modifier_classlist_add plus ui_component_bem_modifier_style_declare for modifiers. Use ui_component_bem_*_style_delete tools to remove obsolete state, element, or modifier selectors; do not delete and recreate a whole component to remove hover or nested selector styles. For variant values, use modifierName variant with value primary; do not use modifierName variant-primary, because Starfront renders nested SCSS as &_variant { &-primary { ... } }. For prop-driven variants/colors/states, use ui_component_prop_create first; variant and color automatically add root class:list modifiers. Avoid creating elements named variant/_variant/__variant because variants are usually BEM modifiers, not elements. Read markup after each root mutation because paths can change. Style declarations are idempotent per selector/media/state; repeated properties are replaced. Conditions are parenthesized automatically when rendered. command_run is only for debugging or replaying exact CLI commands. If command_run is necessary, component commands must use the full CLI form: starfront ui component <action> ...; do not omit the ui namespace.',
        commands: starfrontCommandReference,
        mcpExamples: [
          {
            tool: 'ui_component_bem_block_style_declare',
            input: {
              name: 'button',
              base: 'display: inline-flex; align-items: center',
            },
          },
          {
            tool: 'ui_component_root_append',
            input: {
              name: 'button',
              node: '1',
              tag: 'span',
              elementName: 'text',
            },
          },
          {
            tool: 'ui_component_bem_element_style_declare',
            input: {
              name: 'button',
              elementName: 'text',
              base: 'font-size: 16px; color: black',
            },
          },
          {
            tool: 'ui_component_bem_modifier_style_declare',
            input: {
              name: 'button',
              modifierName: 'variant',
              value: 'contained',
              base: 'background: black; color: white',
            },
          },
          {
            tool: 'ui_component_bem_element_style_delete',
            input: {
              name: 'button',
              elementName: 'text',
              state: 'hover',
            },
          },
          {
            tool: 'ui_component_root_delete',
            input: {
              name: 'button',
              node: '1.1.4',
            },
          },
        ],
      }),
  )

  server.registerTool(
    'command_history',
    {
      title: 'Starfront MCP command history',
      description: 'Return timestamped CLI-equivalent commands run through this MCP server.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () =>
      jsonResult({
        logFile: path.join(context.getProjectRoot(), '.starfront', 'mcp.log'),
        entries: context.commandLogger.entries(),
      }),
  )

  server.registerTool(
    'command_undo',
    {
      title: 'Undo last Starfront MCP write',
      description:
        'Undo the most recent undoable Starfront MCP write in the current project by restoring the prior UI component file snapshot.',
      inputSchema: {
        projectRoot: z.string().optional().describe('Optional project directory. Defaults to the active project.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ projectRoot }) => jsonResult(await context.commandLogger.undo(context.useProjectRoot(projectRoot))),
  )

  server.registerTool(
    'command_redo',
    {
      title: 'Redo last Starfront MCP undo',
      description:
        'Redo the most recent undone Starfront MCP write in the current project by restoring the post-command UI component file snapshot.',
      inputSchema: {
        projectRoot: z.string().optional().describe('Optional project directory. Defaults to the active project.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ projectRoot }) => jsonResult(await context.commandLogger.redo(context.useProjectRoot(projectRoot))),
  )

  server.registerTool(
    'command_run',
    {
      title: 'Debug/replay Starfront CLI command',
      description:
        'Low-level escape hatch for debugging or replaying exact Starfront CLI commands. Do not use for normal UI component edits; use ui_component_* tools instead. Component commands must be starfront ui component <action> ...; starfront component ... is invalid.',
      inputSchema: {
        command: z
          .string()
          .optional()
          .describe('Full Starfront command string, for example "starfront ui component update button root clear".'),
        args: z
          .array(z.string())
          .optional()
          .describe('Command args without the starfront binary, starting with "ui" for component commands.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ command, args, projectRoot }) => {
      const activeProjectRoot = context.useProjectRoot(projectRoot)
      const normalized = normalizeStarfrontCommandRun({ command, args, cwd: activeProjectRoot })

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: activeProjectRoot,
          tool: 'command_run',
          args: normalized.args,
          run: async () => runStarfrontCommand({ args: normalized.args, cwd: normalized.cwd }),
        }),
      )
    },
  )

  server.registerTool(
    'project_info',
    {
      title: 'Starfront project info',
      description: 'Return the current project root used by this Starfront MCP server.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => jsonResult(projectState(context.getProjectRoot())),
  )

  server.registerTool(
    'project_set_root',
    {
      title: 'Set Starfront project root',
      description: 'Set the project directory for subsequent Starfront MCP tool calls.',
      inputSchema: {
        projectRoot: z.string().min(1).describe('Absolute or relative project directory path.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ projectRoot }) => {
      const resolvedProjectRoot = normalizeProjectRoot(projectRoot)

      if (!existsSync(resolvedProjectRoot)) {
        throw new Error(`Project directory does not exist: ${resolvedProjectRoot}`)
      }

      return jsonResult(
        await context.commandLogger.record({
          projectRoot: resolvedProjectRoot,
          tool: 'project_set_root',
          args: ['mcp', '--project', resolvedProjectRoot],
          run: async () => {
            context.setProjectRoot(resolvedProjectRoot)
            return projectState(context.getProjectRoot())
          },
        }),
      )
    },
  )
}
