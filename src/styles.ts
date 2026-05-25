import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'

import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { renderDefaultScss } from './components/templates.ts'
import { DEFAULT_MEDIA } from './constants.ts'
import {
  ensureSelfVariable,
  ensureStateBlock,
  findSelectorClosingBrace,
  insertIntoSelector,
  selectorForState,
} from './style-edit.ts'
import type { ComponentInfo, Media, StyleDeclareOptions } from './types.ts'
import { toKebabCase } from './utils/naming.ts'
import { renderScssContent } from './utils/parse.ts'
import { normalizeProjectRoot } from './utils/project.ts'

function appendDeclarationBlock(style: string, selector: string, declarations: string, media: Media): string {
  if (!declarations.trim()) {
    return style
  }

  return insertIntoSelector(style, selector, `\n${declarations}`, media)
}

async function ensureElementStyleInMedia(
  name: string,
  elementName: string,
  media: Media,
  cwd?: string,
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const element = toKebabCase(elementName)

  if (!existsSync(files.style)) {
    await writeFile(files.style, renderDefaultScss(info.name))
  }

  const style = await readFile(files.style, 'utf8')
  const selector = `&__${element}`

  try {
    findSelectorClosingBrace(style, selector, media)
    return info
  } catch {
    const indent = media === 'desktop' ? '  ' : '    '
    const spacing = media === 'desktop' ? '\n\n' : '\n'
    const updated = insertIntoSelector(style, `.${info.name}`, `${spacing}${indent}${selector} {\n${indent}}`, media)
    await writeFile(files.style, updated)

    return info
  }
}

export async function ensureElementStyle(name: string, elementName: string, cwd?: string): Promise<ComponentInfo> {
  return ensureElementStyleInMedia(name, elementName, 'desktop', cwd)
}

export async function declareElementStyle(
  name: string,
  elementName: string | undefined,
  options: StyleDeclareOptions = {},
): Promise<ComponentInfo> {
  const targets = (options.targets ?? elementName ?? '')
    .split(',')
    .map(target => toKebabCase(target))
    .filter(Boolean)

  if (!targets.length) {
    throw new Error('Provide an element name or --targets')
  }

  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const media = options.media ?? DEFAULT_MEDIA

  if (options.state) {
    let style = ensureStateBlock(await readFile(files.style, 'utf8'), info.name, options.state)
    const stateSelector = selectorForState(options.state)

    style = ensureSelfVariable(style, info.name)

    for (const target of targets) {
      const selector = `#{$self}__${target}`

      try {
        findSelectorClosingBrace(style, selector, 'desktop')
      } catch {
        style = insertIntoSelector(style, stateSelector, `\n\n    ${selector} {\n    }`, 'desktop')
      }

      style = appendDeclarationBlock(style, selector, renderScssContent(options.base, 3), 'desktop')
    }

    await writeFile(files.style, style)
    return info
  }

  for (const target of targets) {
    await ensureElementStyleInMedia(info.name, target, media, projectRoot)
  }

  let style = await readFile(files.style, 'utf8')
  const indent = media === 'desktop' ? 2 : 3
  const declarations = renderScssContent(options.base, indent)

  for (const target of targets) {
    style = appendDeclarationBlock(style, `&__${target}`, declarations, media)
  }

  await writeFile(files.style, style)
  return info
}

export async function declareBlockStyle(name: string, options: StyleDeclareOptions = {}): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const media = options.media ?? DEFAULT_MEDIA
  let style = await readFile(files.style, 'utf8')

  style = appendDeclarationBlock(
    style,
    `.${info.name}`,
    renderScssContent(options.base, media === 'desktop' ? 1 : 2),
    media,
  )

  const stateBlocks = {
    hover: options.hover ? `\n\n  @include hover() {\n${renderScssContent(options.hover, 2)}\n  }` : '',
    active: options.active ? `\n\n  &:active {\n${renderScssContent(options.active, 2)}\n  }` : '',
    disabled: options.disabled ? `\n\n  &[disabled] {\n${renderScssContent(options.disabled, 2)}\n  }` : '',
  }

  for (const block of Object.values(stateBlocks)) {
    style = insertIntoSelector(style, `.${info.name}`, block, 'desktop')
  }

  await writeFile(files.style, style)
  return info
}
