import type { Media, StyleDeclareOptions } from './types.ts'
import { mediaQuery } from './utils/media.ts'

function findMatchingBrace(content: string, openingBraceIndex: number): number {
  if (openingBraceIndex === -1) {
    throw new Error('Opening brace not found')
  }

  let depth = 0

  for (let index = openingBraceIndex; index < content.length; index += 1) {
    const char = content[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  throw new Error('Closing brace not found')
}

export function findSelectorClosingBrace(style: string, selector: string, media: Media): number {
  const query = mediaQuery(media)
  const searchStart = query ? style.indexOf(query) : 0

  if (searchStart === -1) {
    throw new Error(`Media block not found: ${query}`)
  }

  const searchEnd = query ? findMatchingBrace(style, style.indexOf('{', searchStart + query.length)) : style.length
  const selectorIndex = style.indexOf(selector, searchStart)

  if (selectorIndex === -1 || selectorIndex > searchEnd) {
    throw new Error(`Style selector not found: ${selector}`)
  }

  const openingBraceIndex = style.indexOf('{', selectorIndex + selector.length)

  if (openingBraceIndex > searchEnd) {
    throw new Error(`Style selector not found in media block: ${selector}`)
  }

  return findMatchingBrace(style, openingBraceIndex)
}

function findSelectorOpeningBrace(style: string, selector: string, media: Media): number {
  const query = mediaQuery(media)
  const searchStart = query ? style.indexOf(query) : 0

  if (searchStart === -1) {
    throw new Error(`Media block not found: ${query}`)
  }

  const searchEnd = query ? findMatchingBrace(style, style.indexOf('{', searchStart + query.length)) : style.length
  const selectorIndex = style.indexOf(selector, searchStart)

  if (selectorIndex === -1 || selectorIndex > searchEnd) {
    throw new Error(`Style selector not found: ${selector}`)
  }

  const openingBraceIndex = style.indexOf('{', selectorIndex + selector.length)

  if (openingBraceIndex > searchEnd) {
    throw new Error(`Style selector not found in media block: ${selector}`)
  }

  return openingBraceIndex
}

export function insertIntoSelector(style: string, selector: string, insertion: string, media: Media): string {
  const closingBraceIndex = findSelectorClosingBrace(style, selector, media)
  const beforeClosing = style.slice(0, closingBraceIndex)
  const closingIndent = beforeClosing.match(/[ \t]*$/)?.[0] ?? ''

  return `${beforeClosing.trimEnd()}${insertion}\n${closingIndent}${style.slice(closingBraceIndex)}`
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
  } catch {
    return insertIntoSelector(style, `.${blockName}`, `\n\n  ${selector} {\n  }`, 'desktop')
  }
}
