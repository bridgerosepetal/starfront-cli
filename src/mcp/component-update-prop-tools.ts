import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { runComponentUpdate } from './component-update-shared.ts'
import type { McpToolContext } from './tool-context.ts'

export function registerPropTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_prop_group_create',
    {
      title: 'Create component prop group',
      description:
        'Create a Props interface group, for example ButtonProps extends HTMLAttributes<button> or AnchorProps extends HTMLAttributes<a>.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        groupName: z.string().min(1).describe('Props group/interface name, for example ButtonProps.'),
        extends: z.string().min(1).describe('Base type for the group, for example HTMLAttributes<button>.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, groupName, extends: extendsType }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_prop_group_create',
        name,
        ['prop', 'group', 'create', groupName],
        {
          extends: extendsType,
        },
      ),
  )

  server.registerTool(
    'ui_component_prop_create',
    {
      title: 'Create component prop',
      description:
        'Create a prop with optional default, group assignment, required flag, and destructuring control. Creating a prop named variant or color automatically adds the matching root BEM modifier expression to class:list.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        propName: z.string().min(1).describe('Prop name.'),
        type: z.string().min(1).describe('TypeScript type, for example string, IconKey, or "contained | text".'),
        defaultValue: z.string().optional().describe('Optional default value.'),
        group: z.string().optional().describe('Props group/interface name to place this prop in.'),
        required: z.boolean().optional().describe('Make the prop required. Defaults to false.'),
        destructure: z.boolean().optional().describe('Destructure this prop from Astro.props. Defaults to true.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, propName, type, defaultValue, group, required, destructure }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_prop_create',
        name,
        ['prop', 'create', propName, type, ...(defaultValue ? [defaultValue] : [])],
        { group, required, destructure },
      ),
  )

  server.registerTool(
    'ui_component_prop_update',
    {
      title: 'Update component prop',
      description:
        'Update one existing prop. Maps to starfront ui component update <name> prop update <propName> [type] [defaultValue].',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        propName: z.string().min(1).describe('Prop name.'),
        type: z.string().optional().describe('Replacement TypeScript type. Omit to keep the current type.'),
        defaultValue: z.string().optional().describe('Replacement default value.'),
        group: z
          .string()
          .optional()
          .describe('Props group/interface name when the prop name appears in multiple groups.'),
        required: z.boolean().optional().describe('Make the prop required. Defaults to false.'),
        destructure: z.boolean().optional().describe('Destructure this prop from Astro.props. Defaults to true.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, propName, type, defaultValue, group, required, destructure }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_prop_update',
        name,
        ['prop', 'update', propName, ...(type ? [type] : []), ...(defaultValue ? [defaultValue] : [])],
        { group, required, destructure },
      ),
  )

  server.registerTool(
    'ui_component_prop_delete',
    {
      title: 'Delete component prop',
      description: 'Delete one existing prop. Maps to starfront ui component update <name> prop delete <propName>.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        propName: z.string().min(1).describe('Prop name.'),
        group: z
          .string()
          .optional()
          .describe('Props group/interface name when the prop name appears in multiple groups.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, propName, group }) =>
      runComponentUpdate(context, projectRoot, 'ui_component_prop_delete', name, ['prop', 'delete', propName], {
        group,
      }),
  )
}
