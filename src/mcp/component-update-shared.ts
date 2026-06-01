import { bemModifierClassListItem } from '../bem.ts'
import { dispatchUpdate } from '../cli/dispatch.ts'
import { cliArgsWithOptions } from '../command-vocabulary.ts'
import { toKebabCase } from '../utils/naming.ts'

import { jsonResult, type McpToolContext } from './tool-context.ts'

export type UpdateMetadata = {
  warnings?: string[]
}

export async function runComponentUpdate(
  context: McpToolContext,
  projectRoot: string | undefined,
  tool: string,
  name: string,
  tokens: string[],
  options: Record<string, unknown> = {},
  metadata: UpdateMetadata = {},
): Promise<ReturnType<typeof jsonResult>> {
  const activeProjectRoot = context.useProjectRoot(projectRoot)
  const result = await context.commandLogger.record({
    projectRoot: activeProjectRoot,
    tool,
    args: cliArgsWithOptions(['ui', 'component', 'update', name, ...tokens], options),
    run: async () => dispatchUpdate(name, tokens, options, activeProjectRoot),
  })

  return jsonResult(metadata.warnings?.length ? { result, warnings: metadata.warnings } : result)
}

export function warnIfElementLooksLikeModifier(componentName: string, elementName?: string): string[] {
  if (!elementName) {
    return []
  }

  const blockName = toKebabCase(componentName)
  const raw = elementName.trim()
  const withoutBlock = raw.replace(new RegExp(`^${blockName}__`, 'i'), '')
  const candidate = withoutBlock.replace(/^_+/, '')
  const kebab = toKebabCase(candidate)

  if (
    raw.startsWith('_') ||
    raw.includes('__variant') ||
    raw.includes('__color') ||
    ['variant', 'color'].includes(kebab) ||
    kebab.startsWith('variant-') ||
    kebab.startsWith('color-')
  ) {
    return [
      `BEM element "${elementName}" looks like a root modifier. For variants, prefer a modifier class such as ${blockName}_${kebab || 'variant'} and use ui_component_bem_modifier_classlist_add plus ui_component_bem_modifier_style_declare.`,
    ]
  }

  return []
}

export { bemModifierClassListItem }
