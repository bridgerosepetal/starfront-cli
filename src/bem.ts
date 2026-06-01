import { toKebabCase } from './utils/naming.ts'

export function bemModifierClassListItem(
  componentName: string,
  modifierName: string,
  options: { expression?: string; propName?: string; value?: string },
): string {
  if (options.expression) {
    return options.expression
  }

  const blockName = toKebabCase(componentName)
  const modifier = toKebabCase(modifierName)

  if (!modifier) {
    throw new Error('Provide a modifier name')
  }

  if (options.propName) {
    return [options.propName, ' && `', blockName, '_', modifier, '-${', options.propName, '}`'].join('')
  }

  if (options.value) {
    return JSON.stringify(`${blockName}_${modifier}-${toKebabCase(options.value)}`)
  }

  return JSON.stringify(`${blockName}_${modifier}`)
}
