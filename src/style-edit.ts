import { createRequire } from 'node:module'

import { CssSyntaxError, type AtRule, type Container, type Node, type Rule, type Root } from 'postcss'

import type { Media, StyleDeclareOptions } from './types.ts'
import { mediaQuery } from './utils/media.ts'
import { parseDeclarations } from './utils/parse.ts'

const require = createRequire(import.meta.url)
let loadedSassParser: typeof import('sass-parser') | undefined

export class StyleSelectorNotFoundError extends Error {}
export class StyleMediaNotFoundError extends Error {}

function sassParser(): typeof import('sass-parser') {
  loadedSassParser ??= require('sass-parser') as typeof import('sass-parser')

  return loadedSassParser
}

function errorLocationFromMessage(message: string): { line: number; column: number } | undefined {
  const match = message.match(/\s-\s(\d+):(\d+)\s+root stylesheet/)
  const line = match?.[1] ? Number.parseInt(match[1], 10) : NaN
  const column = match?.[2] ? Number.parseInt(match[2], 10) : NaN

  return Number.isFinite(line) && Number.isFinite(column) ? { line, column } : undefined
}

function normalizeScssParseError(error: unknown): Error {
  if (error instanceof CssSyntaxError) {
    const reason = error.reason.toLowerCase()

    if (reason.includes('unexpected }')) {
      return new Error(`Invalid SCSS: unexpected closing brace at ${error.line}:${error.column}`)
    }

    return new Error(`Invalid SCSS: ${error.reason} at ${error.line}:${error.column}`)
  }

  if (error instanceof Error) {
    const location = errorLocationFromMessage(error.message)
    const message = error.message.toLowerCase()

    if (message.includes('unmatched "}"') && location) {
      return new Error(`Invalid SCSS: unexpected closing brace at ${location.line}:${location.column}`)
    }

    return new Error(`Invalid SCSS: ${error.message}`)
  }

  return new Error(`Invalid SCSS: ${String(error)}`)
}

function parseScss(style: string): Root {
  try {
    return sassParser().scss.parse(style) as unknown as Root
  } catch (error) {
    throw normalizeScssParseError(error)
  }
}

function isContainer(node: Node): node is Container {
  return 'nodes' in node
}

function nodeStartOffset(node: Node): number {
  return node.source?.start?.offset ?? 0
}

function nodeEndOffset(node: Node): number {
  return node.source?.end?.offset ?? 0
}

function matchesSelector(node: Node, selector: string): boolean {
  if (node.type === 'rule') {
    return (node as Rule).selector === selector
  }

  if (node.type !== 'atrule' || !selector.startsWith('@')) {
    return false
  }

  const atRule = node as AtRule
  const rendered = atRule.params ? `@${atRule.name} ${atRule.params}` : `@${atRule.name}`

  return rendered === selector || `${rendered}()` === selector
}

function isMediaAtRule(node: Node): boolean {
  return node.type === 'atrule' && (node as AtRule).name === 'media'
}

function findFirstDescendant(
  container: Container,
  predicate: (node: Node) => boolean,
  shouldSkip?: (node: Node) => boolean,
): Node | undefined {
  for (const child of container.nodes ?? []) {
    if (shouldSkip?.(child)) {
      continue
    }

    if (predicate(child)) {
      return child
    }

    if (isContainer(child)) {
      const found = findFirstDescendant(child, predicate, shouldSkip)

      if (found) {
        return found
      }
    }
  }

  return undefined
}

function mediaSelector(media: Media): string | null {
  const query = mediaQuery(media)

  return query ? query.replace(/^@media\s+/, '') : null
}

function findMediaContainer(root: Root, media: Media): Container {
  const selector = mediaSelector(media)

  if (!selector) {
    return root
  }

  const mediaNode = findFirstDescendant(
    root,
    node => node.type === 'atrule' && (node as AtRule).name === 'media' && (node as AtRule).params === selector,
  )

  if (!mediaNode || !isContainer(mediaNode)) {
    throw new StyleMediaNotFoundError(`Media block not found: ${mediaQuery(media)}`)
  }

  return mediaNode
}

function findStyleNode(style: string, selector: string, media: Media, parentSelector?: string): Node {
  const root = parseScss(style)
  const mediaRoot = findMediaContainer(root, media)
  const shouldSkip = media === 'desktop' ? isMediaAtRule : undefined
  const searchRoot = parentSelector
    ? findFirstDescendant(mediaRoot, candidate => matchesSelector(candidate, parentSelector), shouldSkip)
    : mediaRoot

  if (!searchRoot || !isContainer(searchRoot)) {
    throw new StyleSelectorNotFoundError(`Style selector not found: ${parentSelector}`)
  }

  const node = findFirstDescendant(searchRoot, candidate => matchesSelector(candidate, selector), shouldSkip)

  if (!node || !isContainer(node)) {
    throw new StyleSelectorNotFoundError(`Style selector not found: ${selector}`)
  }

  return node
}

function findNodeOpeningBrace(style: string, node: Node): number {
  const start = nodeStartOffset(node)
  const end = nodeEndOffset(node)
  const selectorLength =
    node.type === 'rule'
      ? (node as Rule).selector.length
      : node.type === 'atrule'
        ? `@${(node as AtRule).name}${(node as AtRule).params ? ` ${(node as AtRule).params}` : ''}`.length
        : 0
  const openingBraceIndex = style.indexOf('{', start + selectorLength)

  if (openingBraceIndex === -1 || openingBraceIndex >= end) {
    throw new Error('Opening brace not found')
  }

  return openingBraceIndex
}

function findNodeClosingBrace(style: string, node: Node): number {
  const end = nodeEndOffset(node)
  const closingBraceIndex = style.lastIndexOf('}', end)

  if (closingBraceIndex === -1 || closingBraceIndex < nodeStartOffset(node)) {
    throw new Error('Closing brace not found')
  }

  return closingBraceIndex
}

export function findSelectorClosingBrace(style: string, selector: string, media: Media): number {
  return findNodeClosingBrace(style, findStyleNode(style, selector, media))
}


export function findSelectorOpeningBrace(style: string, selector: string, media: Media): number {
  const node = findStyleNode(style, selector, media)

  return findNodeOpeningBrace(style, node)
}

function findNestedSelectorClosingBrace(
  style: string,
  parentSelector: string,
  selector: string,
  media: Media,
): number {
  return findNodeClosingBrace(style, findStyleNode(style, selector, media, parentSelector))
}

function findNestedSelectorOpeningBrace(
  style: string,
  parentSelector: string,
  selector: string,
  media: Media,
): number {
  return findNodeOpeningBrace(style, findStyleNode(style, selector, media, parentSelector))
}

function removeStyleNode(style: string, node: Node): string {
  let start = nodeStartOffset(node)
  const end = nodeEndOffset(node) + 1
  const lineEnding = style.includes('\r\n') ? '\r\n' : '\n'

  while (start > 0 && (style[start - 1] === ' ' || style[start - 1] === '\t')) {
    start -= 1
  }

  let next = `${style.slice(0, start)}${style.slice(end)}`

  next = next.replace(/(?:\r?\n){3,}/g, `${lineEnding}${lineEnding}`)

  return next
}

export function deleteStyleSelector(
  style: string,
  selector: string,
  media: Media,
  parentSelector?: string,
): string {
  try {
    return removeStyleNode(style, findStyleNode(style, selector, media, parentSelector))
  } catch (error) {
    if (error instanceof StyleSelectorNotFoundError || error instanceof StyleMediaNotFoundError) {
      return style
    }

    throw error
  }
}

export function insertIntoSelector(style: string, selector: string, insertion: string, media: Media): string {
  const closingBraceIndex = findSelectorClosingBrace(style, selector, media)
  const beforeClosing = style.slice(0, closingBraceIndex)
  const closingIndent = beforeClosing.match(/[ \t]*$/)?.[0] ?? ''

  return `${beforeClosing.trimEnd()}${insertion}\n${closingIndent}${style.slice(closingBraceIndex)}`
}

type StyleFragmentNode =
  | {
      kind: 'declaration'
      property: string
      value: string
    }
  | {
      kind: 'block'
      selector: string
      children: StyleFragmentNode[]
    }

function sourceSlice(source: string, node: Node): string {
  const start = node.source?.start?.offset ?? 0
  const end = node.source?.end?.offset ?? start

  return source.slice(start, end + 1)
}

function rawDeclaration(source: string, node: Node): { property: string; value: string } | undefined {
  const raw = sourceSlice(source, node).trim().replace(/;$/, '')
  const separatorIndex = raw.indexOf(':')

  if (separatorIndex === -1) {
    return undefined
  }

  const property = raw.slice(0, separatorIndex).trim()
  const value = raw.slice(separatorIndex + 1).trim()

  return property && value ? { property, value } : undefined
}

function openingBraceFromSource(source: string, node: Node): number {
  const children = isContainer(node) ? node.nodes : undefined
  const firstChild = children?.[0]

  if (firstChild?.source?.start?.offset !== undefined) {
    const openingBraceIndex = source.lastIndexOf('{', firstChild.source.start.offset)

    if (openingBraceIndex !== -1 && openingBraceIndex >= nodeStartOffset(node)) {
      return openingBraceIndex
    }
  }

  return findNodeOpeningBrace(source, node)
}

function rawBlockSelector(source: string, node: Node): string {
  return source.slice(nodeStartOffset(node), openingBraceFromSource(source, node)).trim()
}

function fragmentNodeFromAst(source: string, node: Node): StyleFragmentNode | undefined {
  if (node.type === 'decl') {
    const declaration = rawDeclaration(source, node)

    return declaration ? { kind: 'declaration', ...declaration } : undefined
  }

  if (!isContainer(node) || (node.type !== 'rule' && node.type !== 'atrule')) {
    return undefined
  }

  return {
    kind: 'block',
    selector: rawBlockSelector(source, node),
    children: (node.nodes ?? []).map(child => fragmentNodeFromAst(source, child)).filter(Boolean) as StyleFragmentNode[],
  }
}

export function parseStyleFragment(content: string | undefined): StyleFragmentNode[] {
  if (!content?.trim()) {
    return []
  }

  const body = content.trim()

  if (!body.includes('{') && !body.includes('\n')) {
    return Object.entries(parseDeclarations(body)).map(([property, value]) => ({
      kind: 'declaration',
      property,
      value,
    }))
  }

  const source = `.starfront-fragment {\n${/[;}]$/.test(body) ? body : `${body};`}\n}`
  const root = parseScss(source)
  const wrapper = root.nodes[0]

  if (!wrapper || !isContainer(wrapper)) {
    return []
  }

  return (wrapper.nodes ?? []).map(node => fragmentNodeFromAst(source, node)).filter(Boolean) as StyleFragmentNode[]
}

function renderDeclarationEntries(nodes: StyleFragmentNode[]): string {
  return nodes
    .filter((node): node is Extract<StyleFragmentNode, { kind: 'declaration' }> => node.kind === 'declaration')
    .map(node => `${node.property}: ${node.value}`)
    .join('; ')
}

export function upsertStyleFragmentInSelector(
  style: string,
  selector: string,
  content: string | undefined,
  indentLevel: number,
  media: Media,
): string {
  return applyStyleFragmentNodes(style, selector, parseStyleFragment(content), indentLevel, media)
}

export function upsertStyleFragmentInNestedSelector(
  style: string,
  parentSelector: string,
  selector: string,
  content: string | undefined,
  indentLevel: number,
  media: Media,
): string {
  return applyStyleFragmentNodes(style, selector, parseStyleFragment(content), indentLevel, media, parentSelector)
}

function applyStyleFragmentNodes(
  style: string,
  selector: string,
  nodes: StyleFragmentNode[],
  indentLevel: number,
  media: Media,
  parentSelector?: string,
): string {
  const declarations = renderDeclarationEntries(nodes)

  if (declarations) {
    style = upsertDeclarationsInSelector(style, selector, declarations, indentLevel, media, parentSelector)
  }

  for (const node of nodes) {
    if (node.kind !== 'block') {
      continue
    }

    style = ensureNestedSelector(style, selector, node.selector, indentLevel + 1, media, parentSelector)
    style = applyStyleFragmentNodes(style, node.selector, node.children, indentLevel + 1, media, selector)
  }

  return style
}

export function ensureNestedSelector(
  style: string,
  parentSelector: string,
  nestedSelector: string,
  indentLevel: number,
  media: Media,
  scopeParentSelector?: string,
): string {
  const openingBraceIndex = scopeParentSelector
    ? findNestedSelectorOpeningBrace(style, scopeParentSelector, parentSelector, media)
    : findSelectorOpeningBrace(style, parentSelector, media)
  const closingBraceIndex = scopeParentSelector
    ? findNestedSelectorClosingBrace(style, scopeParentSelector, parentSelector, media)
    : findSelectorClosingBrace(style, parentSelector, media)
  const parentContent = style.slice(openingBraceIndex + 1, closingBraceIndex)

  if (parentContent.includes(`${nestedSelector} {`)) {
    return style
  }

  const indent = '  '.repeat(indentLevel)
  const spacing = media === 'desktop' ? '\n\n' : '\n'

  return insertIntoSelector(style, parentSelector, `${spacing}${indent}${nestedSelector} {\n${indent}}`, media)
}

export function upsertDeclarationsInSelector(
  style: string,
  selector: string,
  content: string | undefined,
  indentLevel: number,
  media: Media,
  parentSelector?: string,
): string {
  const declarations = parseDeclarations(content)
  const entries = Object.entries(declarations)

  if (!entries.length) {
    return style
  }

  const openingBraceIndex = parentSelector
    ? findNestedSelectorOpeningBrace(style, parentSelector, selector, media)
    : findSelectorOpeningBrace(style, selector, media)
  const closingBraceIndex = parentSelector
    ? findNestedSelectorClosingBrace(style, parentSelector, selector, media)
    : findSelectorClosingBrace(style, selector, media)
  const indent = '  '.repeat(indentLevel)
  const inner = style.slice(openingBraceIndex + 1, closingBraceIndex)
  const lineEnding = style.includes('\r\n') ? '\r\n' : '\n'
  const seen = new Set<string>()
  let nestedDepth = 0
  let firstNestedLineIndex = -1

  const sourceLines = inner.split(/\r?\n/)

  if (sourceLines[0]?.trim() === '') {
    sourceLines.shift()
  }

  if (sourceLines.at(-1)?.trim() === '') {
    sourceLines.pop()
  }

  const updatedLines = sourceLines.map((line, lineIndex) => {
    const trimmed = line.trim()
    const declarationMatch = nestedDepth === 0 ? trimmed.match(/^([-$\w]+)\s*:\s*[^;]+;$/) : null
    let updatedLine = line

    if (nestedDepth === 0 && firstNestedLineIndex === -1 && trimmed && !declarationMatch && trimmed.includes('{')) {
      firstNestedLineIndex = lineIndex
    }

    if (declarationMatch) {
      const property = declarationMatch[1]

      if (property && Object.hasOwn(declarations, property)) {
        updatedLine = `${indent}${property}: ${declarations[property]};`
        seen.add(property)
      }
    }

    nestedDepth += (trimmed.match(/{/g) ?? []).length
    nestedDepth -= (trimmed.match(/}/g) ?? []).length

    return updatedLine
  })

  const missing = entries
    .filter(([property]) => !seen.has(property))
    .map(([property, value]) => `${indent}${property}: ${value};`)

  const nextLines = updatedLines.map(line => line.trimEnd())
  let insertionIndex = firstNestedLineIndex === -1 ? nextLines.length : firstNestedLineIndex

  while (insertionIndex > 0 && nextLines[insertionIndex - 1]?.trim() === '') {
    insertionIndex -= 1
  }

  nextLines.splice(insertionIndex, 0, ...missing)

  const nextInner = nextLines.join(lineEnding).trimEnd()

  return `${style.slice(0, openingBraceIndex + 1)}${lineEnding}${nextInner}${lineEnding}${'  '.repeat(
    Math.max(indentLevel - 1, 0),
  )}${style.slice(closingBraceIndex)}`
}

export function ensureSelfVariable(style: string, blockName: string): string {
  const openingBraceIndex = findSelectorOpeningBrace(style, `.${blockName}`, 'desktop')
  const closingBraceIndex = findSelectorClosingBrace(style, `.${blockName}`, 'desktop')
  const blockContent = style.slice(openingBraceIndex, closingBraceIndex)

  if (blockContent.includes('$self: &;')) {
    return style
  }

  return `${style.slice(0, openingBraceIndex + 1)}\n  $self: &;${style.slice(openingBraceIndex + 1)}`
}

export function selectorForState(state: StyleDeclareOptions['state']): string {
  if (state === 'hover') {
    return '@include hover()'
  }

  if (state === 'active') {
    return '&:active'
  }

  if (state === 'disabled') {
    return '&[disabled]'
  }

  throw new Error(`Unsupported state: ${String(state)}`)
}

export function ensureStateBlock(style: string, blockName: string, state: StyleDeclareOptions['state']): string {
  const selector = selectorForState(state)

  try {
    findSelectorClosingBrace(style, selector, 'desktop')
    return style
  } catch (error) {
    if (!(error instanceof StyleSelectorNotFoundError)) {
      throw error
    }

    return insertIntoSelector(style, `.${blockName}`, `\n\n  ${selector} {\n  }`, 'desktop')
  }
}
