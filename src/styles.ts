import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { renderDefaultScss } from './components/templates.ts'
import { DEFAULT_MEDIA } from './constants.ts'
import {
  deleteStyleSelector,
  ensureSelfVariable,
  ensureStateBlock,
  findSelectorClosingBrace,
  insertIntoSelector,
  selectorForState,
  StyleSelectorNotFoundError,
  upsertStyleFragmentInSelector,
} from './style-edit.ts'
import { writeScssFile } from './scss.ts'
import type { ComponentInfo, Media, StyleDeclareOptions, StyleDeleteOptions } from './types.ts'
import { toKebabCase } from './utils/naming.ts'
import { normalizeProjectRoot } from './utils/project.ts'

export { declareModifierStyle, deleteModifierStyle } from './modifier-styles.ts'

function declareIntoSelector(
  style: string,
  selector: string,
  declarations: string | undefined,
  indentLevel: number,
  media: Media,
): string {
  if (!declarations?.trim()) {
    return style
  }

  return upsertStyleFragmentInSelector(style, selector, declarations, indentLevel, media)
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
    await writeScssFile(files.style, renderDefaultScss(info.name))
  }

  const style = await readFile(files.style, 'utf8')
  const selector = `&__${element}`

  try {
    findSelectorClosingBrace(style, selector, media)
    return info
  } catch (error) {
    if (!(error instanceof StyleSelectorNotFoundError)) {
      throw error
    }

    const indent = media === 'desktop' ? '  ' : '    '
    const spacing = media === 'desktop' ? '\n\n' : '\n'
    const updated = insertIntoSelector(style, `.${info.name}`, `${spacing}${indent}${selector} {\n${indent}}`, media)
    await writeScssFile(files.style, updated)

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
      } catch (error) {
        if (!(error instanceof StyleSelectorNotFoundError)) {
          throw error
        }

        style = insertIntoSelector(style, stateSelector, `\n\n    ${selector} {\n    }`, 'desktop')
      }

      style = declareIntoSelector(style, selector, options.base, 3, 'desktop')
    }

    await writeScssFile(files.style, style)
    return info
  }

  for (const target of targets) {
    await ensureElementStyleInMedia(info.name, target, media, projectRoot)
  }

  let style = await readFile(files.style, 'utf8')
  const indent = media === 'desktop' ? 2 : 3

  for (const target of targets) {
    style = declareIntoSelector(style, `&__${target}`, options.base, indent, media)
  }

  await writeScssFile(files.style, style)
  return info
}

export async function deleteElementStyle(
  name: string,
  elementName: string | undefined,
  options: StyleDeleteOptions = {},
): Promise<ComponentInfo> {
  const targets = (elementName ?? '')
    .split(',')
    .map(target => toKebabCase(target))
    .filter(Boolean)

  if (!targets.length) {
    throw new Error('Provide an element name')
  }

  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const media = options.media ?? DEFAULT_MEDIA
  let style = await readFile(files.style, 'utf8')

  for (const target of targets) {
    style = options.state
      ? deleteStyleSelector(style, `#{$self}__${target}`, 'desktop', selectorForState(options.state))
      : deleteStyleSelector(style, `&__${target}`, media)
  }

  await writeScssFile(files.style, style)
  return info
}

export async function declareBlockStyle(name: string, options: StyleDeclareOptions = {}): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const media = options.media ?? DEFAULT_MEDIA
  let style = await readFile(files.style, 'utf8')

  style = declareIntoSelector(style, `.${info.name}`, options.base, media === 'desktop' ? 1 : 2, media)

  const stateDeclarations = {
    hover: options.hover,
    active: options.active,
    disabled: options.disabled,
  } as const

  for (const [state, declarations] of Object.entries(stateDeclarations)) {
    if (!declarations) {
      continue
    }

    style = ensureStateBlock(style, info.name, state as StyleDeclareOptions['state'])
    style = declareIntoSelector(
      style,
      selectorForState(state as StyleDeclareOptions['state']),
      declarations,
      2,
      'desktop',
    )
  }

  await writeScssFile(files.style, style)
  return info
}

export async function deleteBlockStyle(name: string, options: StyleDeleteOptions = {}): Promise<ComponentInfo> {
  if (!options.state) {
    throw new Error('bem block style delete requires --state')
  }

  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  let style = await readFile(files.style, 'utf8')

  style = deleteStyleSelector(style, selectorForState(options.state), 'desktop')

  await writeScssFile(files.style, style)
  return info
}
