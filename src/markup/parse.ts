import { parse as parseAstro } from '@astrojs/compiler'
import type { Node as AstroNode, AttributeNode, TagLikeNode } from '@astrojs/compiler/types'

import { ROOT_PATH } from '../constants.ts'
import type { ElementMarkupNode, MarkupNode } from '../types.ts'
import { sourceForExpression } from '../utils/source.ts'

function isTagLikeNode(node: AstroNode): node is TagLikeNode {
  return ['element', 'component', 'custom-element', 'fragment'].includes(node.type)
}

function isParentLikeNode(node: AstroNode): node is AstroNode & {
  children: AstroNode[]
} {
  return 'children' in node && Array.isArray(node.children)
}

function normalizeAttributeValue(attribute: AttributeNode): string | boolean {
  if (attribute.kind === 'empty' || attribute.kind === 'spread') {
    return true
  }

  if (attribute.kind === 'expression') {
    return `{${attribute.value}}`
  }

  if (attribute.kind === 'template-literal') {
    return `\`${attribute.value}\``
  }

  return attribute.value
}

function attributesToRecord(attributes: AttributeNode[] | undefined): Record<string, string | boolean> {
  const record: Record<string, string | boolean> = {}

  for (const attribute of attributes ?? []) {
    const name = attribute.kind === 'spread' ? `...${attribute.name}` : attribute.name
    record[name] = normalizeAttributeValue(attribute)
  }

  return record
}

export function classValueFromAttributes(attributes: Record<string, string | boolean>): string {
  const classValue = attributes.class

  if (typeof classValue === 'string') {
    return classValue
  }

  const classListValue = attributes['class:list']

  return typeof classListValue === 'string' ? classListValue : ''
}

function inferBemElementName(blockName: string, classValue: string): string | undefined {
  const elementMatch = classValue.match(new RegExp(`${blockName}__([a-z0-9-]+)`, 'i'))

  return elementMatch?.[1]
}

function inferStyleMode(blockName: string, classValue: string): ElementMarkupNode['style'] | undefined {
  if (classValue.includes(`${blockName}__`)) {
    return { mode: 'bem-element' }
  }

  return classValue.includes(blockName) ? { mode: 'bem-block' } : undefined
}

function expressionToString(node: { children: AstroNode[] }): string {
  return node.children
    .map(child => {
      if (child.type === 'text' && 'value' in child) {
        return child.value.trim()
      }

      return isTagLikeNode(child) ? `<${child.name}>` : ''
    })
    .filter(Boolean)
    .join(' ')
}

function conditionFromExpressionRaw(raw: string | undefined): string | undefined {
  const inner = raw?.replace(/^\{\s*/, '').replace(/\s*\}$/, '')
  const match = inner?.match(/^\s*\(?\s*([A-Za-z_$][\w$.[\]'"]*)\s*\)?\s*&&\s*\(/)

  return match?.[1]
}

function expressionChildren(
  node: AstroNode & { children: AstroNode[] },
  blockName: string,
  pathValue: string,
  source: string,
  isConditional: boolean,
): MarkupNode[] {
  const children = isConditional ? node.children.filter(isTagLikeNode) : node.children

  return convertChildren(children, blockName, pathValue, source)
}

function convertAstroNode(node: AstroNode, blockName: string, pathValue: string, source: string): MarkupNode | null {
  if (node.type === 'text' && 'value' in node) {
    const value = node.value.trim()
    return value ? { kind: 'text', path: pathValue, value } : null
  }

  if (node.type === 'expression' && isParentLikeNode(node)) {
    const raw = sourceForExpression(node, source)
    const condition = conditionFromExpressionRaw(raw)

    return {
      kind: 'expression',
      path: pathValue,
      expression: condition ?? expressionToString(node),
      ...(raw ? { raw } : {}),
      children: expressionChildren(node, blockName, pathValue, source, Boolean(condition)),
    }
  }

  if (!isTagLikeNode(node)) {
    return null
  }

  const attributes = attributesToRecord(node.attributes)

  if (node.type === 'element' && node.name === 'slot') {
    return {
      kind: 'slot',
      path: pathValue,
      name: typeof attributes.name === 'string' ? attributes.name : 'default',
      children: convertChildren(node.children, blockName, pathValue, source),
    }
  }

  if (node.type === 'component') {
    return {
      kind: 'component',
      path: pathValue,
      component: node.name,
      props: attributes,
      children: convertChildren(node.children, blockName, pathValue, source),
    }
  }

  const classValue = classValueFromAttributes(attributes)
  const style = inferStyleMode(blockName, classValue)
  const name = inferBemElementName(blockName, classValue)

  return {
    kind: 'element',
    path: pathValue,
    tag: node.name,
    ...(name ? { name } : {}),
    attributes,
    ...(style ? { style } : {}),
    children: convertChildren(node.children, blockName, pathValue, source),
  }
}

function convertChildren(children: AstroNode[], blockName: string, parentPath: string, source: string): MarkupNode[] {
  const converted: MarkupNode[] = []

  for (const child of children) {
    const childPath = `${parentPath}.${converted.length + 1}`
    const convertedChild = convertAstroNode(child, blockName, childPath, source)

    if (convertedChild) {
      converted.push(convertedChild)
    }
  }

  return converted
}

export async function readMarkupRoot(astroCode: string, blockName: string): Promise<MarkupNode | null> {
  const parsed = await parseAstro(astroCode, { position: true })
  const root = parsed.ast.children.find(node => isTagLikeNode(node) && node.name !== 'style')

  return root ? convertAstroNode(root, blockName, ROOT_PATH, astroCode) : null
}
