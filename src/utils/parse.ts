export function parseKeyValueList(
  values?: string[],
  options: {
    bareIdentifiersAsExpressions?: boolean
  } = {},
): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {}

  for (const value of values ?? []) {
    const [key, ...rawValueParts] = value.split('=')
    const normalizedKey = key?.trim()

    if (!normalizedKey) {
      continue
    }

    let rawValue = rawValueParts.join('=').trim()

    if (
      options.bareIdentifiersAsExpressions &&
      normalizedKey !== 'class' &&
      /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*$/.test(rawValue)
    ) {
      rawValue = `{${rawValue}}`
    }

    parsed[normalizedKey] = rawValue ? rawValue : true
  }

  return parsed
}

export function parseDeclarations(content?: string): Record<string, string> {
  const declarations: Record<string, string> = {}

  for (const part of content?.split(';') ?? []) {
    const trimmed = part.trim()

    if (!trimmed) {
      continue
    }

    const separatorIndex = trimmed.indexOf(':')

    if (separatorIndex === -1) {
      throw new Error(`Invalid CSS declaration: ${trimmed}`)
    }

    const property = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    if (property && value) {
      declarations[property] = value
    }
  }

  return declarations
}

export function renderDeclarations(content: string | undefined, indentLevel: number): string {
  const declarations = parseDeclarations(content)
  const indent = '  '.repeat(indentLevel)

  return Object.entries(declarations)
    .map(([property, value]) => `${indent}${property}: ${value};`)
    .join('\n')
}

export function renderScssContent(content: string | undefined, indentLevel: number): string {
  if (!content) {
    return ''
  }

  if (!content.includes('{') && !content.includes('\n')) {
    return renderDeclarations(content, indentLevel)
  }

  const indent = '  '.repeat(indentLevel)

  return content
    .trim()
    .split(/\r?\n/)
    .map(line => (line.trim() ? `${indent}${line}` : ''))
    .join('\n')
}
