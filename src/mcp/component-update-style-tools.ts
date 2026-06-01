import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { runComponentUpdate, warnIfElementLooksLikeModifier } from './component-update-shared.ts'
import type { McpToolContext } from './tool-context.ts'

export function registerStyleTools(server: McpServer, context: McpToolContext): void {
  registerBemBlockStyleTool(server, context)
  registerBemElementStyleTool(server, context)
  registerBemModifierStyleTool(server, context)
}

function registerBemBlockStyleTool(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_bem_block_style_declare',
    {
      title: 'Declare BEM block styles',
      description:
        'Declare or update styles for the root BEM block selector. Repeated properties are replaced instead of duplicated.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        media: z.enum(['desktop', 'tablet', 'mobile']).optional().describe('Media bucket. Defaults to desktop.'),
        base: z.string().optional().describe('Base CSS declarations, for example "display: flex".'),
        hover: z.string().optional().describe('Block hover declarations.'),
        active: z.string().optional().describe('Block active declarations.'),
        disabled: z.string().optional().describe('Block disabled declarations.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, ...options }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_block_style_declare',
        name,
        ['bem', 'block', 'style', 'declare'],
        options,
      ),
  )

  server.registerTool(
    'ui_component_bem_block_style_delete',
    {
      title: 'Delete BEM block state styles',
      description:
        'Delete one root BEM block state block such as @include hover(). Use this to remove obsolete nested hover/active/disabled rules without recreating the component.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        state: z.enum(['hover', 'active', 'disabled']).describe('Block state selector to delete.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, ...options }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_block_style_delete',
        name,
        ['bem', 'block', 'style', 'delete'],
        options,
      ),
  )
}

function registerBemElementStyleTool(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_bem_element_style_declare',
    {
      title: 'Declare BEM element styles',
      description:
        'Declare or update styles for one BEM element selector like &__text. Repeated properties are replaced instead of duplicated.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        elementName: z.string().min(1).describe('BEM element name, for example icon or text.'),
        targets: z.string().optional().describe('Comma-separated element names for multi-target declarations.'),
        media: z.enum(['desktop', 'tablet', 'mobile']).optional().describe('Media bucket. Defaults to desktop.'),
        state: z.enum(['hover', 'active', 'disabled']).optional().describe('Element state selector.'),
        base: z.string().optional().describe('Base CSS declarations, for example "font-size: 16px; color: black".'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, elementName, ...options }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_element_style_declare',
        name,
        ['bem', 'element', 'style', 'declare', elementName],
        options,
        { warnings: warnIfElementLooksLikeModifier(name, elementName) },
      ),
  )

  server.registerTool(
    'ui_component_bem_element_style_delete',
    {
      title: 'Delete BEM element styles',
      description:
        'Delete a BEM element selector like &__text, or with state delete that element nested inside a block state such as #{$self}__text under @include hover().',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        elementName: z.string().min(1).describe('BEM element name, for example icon or text.'),
        media: z.enum(['desktop', 'tablet', 'mobile']).optional().describe('Media bucket. Defaults to desktop.'),
        state: z
          .enum(['hover', 'active', 'disabled'])
          .optional()
          .describe('Delete this element nested inside a block state selector.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, elementName, ...options }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_element_style_delete',
        name,
        ['bem', 'element', 'style', 'delete', elementName],
        options,
        { warnings: warnIfElementLooksLikeModifier(name, elementName) },
      ),
  )
}

function registerBemModifierStyleTool(server: McpServer, context: McpToolContext): void {
  server.registerTool(
    'ui_component_bem_modifier_style_declare',
    {
      title: 'Declare BEM modifier styles',
      description:
        'Declare or update a root BEM modifier selector like &_variant-contained or &_disabled. Pair with ui_component_bem_modifier_classlist_add for markup class:list wiring.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        modifierName: z
          .string()
          .min(1)
          .describe('BEM modifier name, for example variant, color, disabled, or loading.'),
        value: z
          .string()
          .optional()
          .describe('Optional modifier value, for example contained creates &_variant-contained.'),
        media: z.enum(['desktop', 'tablet', 'mobile']).optional().describe('Media bucket. Defaults to desktop.'),
        state: z.enum(['hover', 'active', 'disabled']).optional().describe('Modifier state selector.'),
        base: z.string().optional().describe('Base CSS declarations, for example "background: black; color: white".'),
        hover: z.string().optional().describe('Modifier hover declarations.'),
        active: z.string().optional().describe('Modifier active declarations.'),
        disabled: z.string().optional().describe('Modifier disabled declarations.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, modifierName, ...options }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_modifier_style_declare',
        name,
        ['bem', 'modifier', 'style', 'declare', modifierName],
        options,
      ),
  )

  server.registerTool(
    'ui_component_bem_modifier_style_delete',
    {
      title: 'Delete BEM modifier styles',
      description:
        'Delete a root BEM modifier selector, a modifier value selector, or one nested modifier state such as hover.',
      inputSchema: {
        name: z.string().min(1).describe('Component name, usually kebab-case.'),
        projectRoot: z.string().optional().describe('Optional project directory to use for this and later calls.'),
        modifierName: z
          .string()
          .min(1)
          .describe('BEM modifier name, for example variant, color, disabled, or loading.'),
        value: z
          .string()
          .optional()
          .describe('Optional modifier value, for example contained targets &-contained under &_variant.'),
        media: z.enum(['desktop', 'tablet', 'mobile']).optional().describe('Media bucket. Defaults to desktop.'),
        state: z.enum(['hover', 'active', 'disabled']).optional().describe('Nested modifier state selector to delete.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ name, projectRoot, modifierName, ...options }) =>
      runComponentUpdate(
        context,
        projectRoot,
        'ui_component_bem_modifier_style_delete',
        name,
        ['bem', 'modifier', 'style', 'delete', modifierName],
        options,
      ),
  )
}
