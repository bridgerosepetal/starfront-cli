const BUILTIN_TYPES = new Set([
  'any',
  'boolean',
  'never',
  'null',
  'number',
  'object',
  'string',
  'undefined',
  'unknown',
  'void',
])

function quoteHtmlAttributeGeneric(type: string): string {
  return type.replace(/\bHTMLAttributes<["']?([a-z][a-z0-9-]*)["']?>/g, (_match, tag: string) => {
    return `HTMLAttributes<'${tag}'>`
  })
}

function isBareLiteral(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(value) && !BUILTIN_TYPES.has(value)
}

function normalizeLiteralUnion(type: string): string {
  const parts = type.split('|').map(part => part.trim())

  if (parts.length < 2 || !parts.every(part => isBareLiteral(part) || /^['"].*['"]$/.test(part))) {
    return type
  }

  return parts.map(part => `'${part.replace(/^['"]|['"]$/g, '')}'`).join(' | ')
}

export function normalizeType(type: string, propName?: string): string {
  const normalizedGeneric = quoteHtmlAttributeGeneric(type)

  if (propName === 'tag' && isBareLiteral(normalizedGeneric.trim())) {
    return `'${normalizedGeneric.trim()}'`
  }

  return normalizeLiteralUnion(normalizedGeneric)
}
