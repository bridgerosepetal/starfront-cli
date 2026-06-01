import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { normalizeUpdateOptions } from './component-update-options.ts'
import { runComponentUpdate, warnIfElementLooksLikeModifier } from './component-update-shared.ts'
import type { McpToolContext } from './tool-context.ts'

export function registerRootTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_root_append',
    {
      title: 'Append component root node',
      description:
        'Append a markup node under a parent path/name. Read markup after mutations because numeric paths can change. Conditions are automatically parenthesized when rendered.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        node: z.string().min(1).describe('Parent node path or element name, for example 1 or icon-start.'),
        tag: z
          .string()
          .optional()
          .describe('HTML tag to append. Use one of tag, component, isSlot, text, or expression.'),
        component: z.string().optional().describe('Astro component to append, for example Icon.'),
        isSlot: z.boolean().optional().describe('Append a slot node. Use slotName for a named slot.'),
        slotName: z.string().optional().describe('Named slot to append. Accepted only when isSlot is true.'),
        text: z.string().optional().describe('Text node content.'),
        expression: z.string().optional().describe('Astro expression content.'),
        elementName: z
          .string()
          .optional()
          .describe('BEM element name for HTML nodes. Do not use this for variants; use a BEM modifier tool.'),
        sibling: z.string().optional().describe('Optional sibling path/name for ordered insertion.'),
        bem: z.string().optional().describe('BEM element class to apply to appended component/element.'),
        attr: z.array(z.string()).optional().describe('HTML attributes as key=value entries.'),
        prop: z.array(z.string()).optional().describe('Component props as key=value entries.'),
        condition: z
          .string()
          .optional()
          .describe('Condition expression. Starfront wraps it safely before && rendering.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async input => {
      const { name, projectRoot, elementName, isSlot, slotName, ...options } = input

      return runComponentUpdate(
        context,
        projectRoot,
        'ui_component_root_append',
        name,
        ['root', 'append'],
        normalizeUpdateOptions({ ...options, isSlot, slotName, name: elementName }),
        {
          warnings: [
            ...warnIfElementLooksLikeModifier(name, elementName),
            ...warnIfElementLooksLikeModifier(name, options.bem),
          ],
        },
      )
    },
  )

  registerClassListTools(server, context)
  registerDeleteTool(server, context)
}

function registerClassListTools(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_root_classlist_add',
    {
      title: 'Add root class:list item',
      description:
        'Add a raw item to the component root class:list. Prefer ui_component_bem_modifier_classlist_add for BEM modifier classes.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        value: z.string().min(1).describe('Raw class:list item, for example variant && `button_variant-${variant}`.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, value }) =>
      runComponentUpdate(context, projectRoot, 'ui_component_root_classlist_add', name, ['root', 'classlist', 'add'], {
        value,
      }),
  )

  server.registerTool(
    'ui_component_bem_modifier_classlist_add',
    {
      title: 'Add BEM modifier class:list item',
      description:
        'Add a BEM modifier class to the root class:list. Use propName for prop-driven variants like variant && `button_variant-${variant}`, value for static classes like button_variant-contained, or expression for a custom raw class:list item.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        modifierName: z
          .string()
          .min(1)
          .describe('BEM modifier name, for example variant, color, disabled, or loading.'),
        propName: z.string().optional().describe('Prop that drives the modifier value. Defaults to modifierName.'),
        value: z.string().optional().describe('Static modifier value, for example contained.'),
        expression: z.string().optional().describe('Custom raw class:list item. Overrides propName and value.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, modifierName, propName, value, expression }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_modifier_classlist_add',
        name,
        ['bem', 'modifier', 'classlist', 'add', modifierName],
        {
          propName: propName ?? (!value && !expression ? modifierName : undefined),
          value,
          expression,
        },
      ),
  )
}

function registerDeleteTool(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_root_delete',
    {
      title: 'Delete component root node',
      description: 'Delete one markup node by current path or element name. Cannot delete the root node itself.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        node: z.string().min(1).describe('Node path or element name to delete, for example 1.1.4 or icon-start.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, projectRoot, node }) =>
      runComponentUpdate(context, projectRoot, 'ui_component_root_delete', name, ['root', 'delete'], { node }),
  )
}
