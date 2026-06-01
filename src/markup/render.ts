import type { MarkupNode } from '../types.ts'

function stringifyAttributeValue(value: string | boolean): string {
  if (value === true) {
    return ''
  }

  if (value === false) {
    return '="false"'
  }

  if (value.startsWith('{') || value.startsWith('[') || value.startsWith('`') || value.startsWith('...')) {
    return `=${value}`
  }

  return `="${value.replaceAll('"', '&quot;')}"`
}

function formatAttributes(attributes: Record<string, string | boolean>): string {
  return Object.entries(attributes)
    .map(([key, value]) => {
      if (key.startsWith('...')) {
        return `{${key}}`
      }

      const formattedValue = stringifyAttributeValue(value)
      return formattedValue ? `${key}${formattedValue}` : key
    })
    .join(' ')
}

export function renderMarkupNode(node: MarkupNode, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel)

  if (node.kind === 'slot') {
    const name = node.name === 'default' ? '' : ` name="${node.name}"`
    const children = node.children?.map(child => renderMarkupNode(child, indentLevel + 1)).join('\n')

    if (!children) {
      return `${indent}<slot${name} />`
    }

    return `${indent}<slot${name}>\n${children}\n${indent}</slot>`
  }

  if (node.kind === 'text') {
    return `${indent}${node.value}`
  }

  if (node.kind === 'expression') {
    if (node.raw) {
      return node.raw
        .trim()
        .split(/\r?\n/)
        .map(line => `${indent}${line.trim()}`)
        .join('\n')
    }

    const children = node.children.map(child => renderMarkupNode(child, indentLevel + 1)).join('\n')

    if (!children) {
      return `${indent}{${node.expression}}`
    }

    return `${indent}{\n${indent}  (${node.expression}) && (\n${children}\n${indent}  )\n${indent}}`
  }

  const tagName = node.kind === 'component' ? node.component : node.tag
  const attributes = node.kind === 'component' ? formatAttributes(node.props) : formatAttributes(node.attributes)
  const opening = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`

  if (!node.children.length) {
    return `${indent}${opening}</${tagName}>`
  }

  const children = node.children.map(child => renderMarkupNode(child, indentLevel + 1)).join('\n')

  return `${indent}${opening}\n${children}\n${indent}</${tagName}>`
}
