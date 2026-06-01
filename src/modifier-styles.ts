import { readFile } from 'node:fs/promises'

import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { DEFAULT_MEDIA } from './constants.ts'
import { writeScssFile } from './scss.ts'
import {
  deleteStyleSelector,
  ensureNestedSelector,
  findSelectorClosingBrace,
  insertIntoSelector,
  selectorForState,
  StyleSelectorNotFoundError,
  upsertStyleFragmentInNestedSelector,
  upsertStyleFragmentInSelector,
} from './style-edit.ts'
import type { ComponentInfo, Media, ModifierStyleDeclareOptions, ModifierStyleDeleteOptions } from './types.ts'
import { toKebabCase } from './utils/naming.ts'
import { normalizeProjectRoot } from './utils/project.ts'

function modifierValueFromName(modifier: string): string | undefined {
  const variantPrefix = 'variant-'

  return modifier.startsWith(variantPrefix) ? modifier.slice(variantPrefix.length) : undefined
}

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

function declareIntoNestedSelector(
  style: string,
  parentSelector: string,
  nestedSelector: string,
  declarations: string | undefined,
  indentLevel: number,
  media: Media,
): string {
  if (!declarations?.trim()) {
    return style
  }

  return upsertStyleFragmentInNestedSelector(style, parentSelector, nestedSelector, declarations, indentLevel, media)
}

function ensureModifierSelector(style: string, blockName: string, selector: string, media: Media): string {
  try {
    findSelectorClosingBrace(style, selector, media)
    return style
  } catch (error) {
    if (!(error instanceof StyleSelectorNotFoundError)) {
      throw error
    }

    const indent = media === 'desktop' ? '  ' : '    '
    const spacing = media === 'desktop' ? '\n\n' : '\n'

    return insertIntoSelector(style, `.${blockName}`, `${spacing}${indent}${selector} {\n${indent}}`, media)
  }
}

function declareStateStyles(
  style: string,
  selector: string,
  options: ModifierStyleDeclareOptions,
  indentLevel: number,
  media: Media,
): string {
  const stateDeclarations = {
    ...(options.state && options.base ? { [options.state]: options.base } : {}),
    hover: options.hover,
    active: options.active,
    disabled: options.disabled,
  } as Partial<Record<NonNullable<ModifierStyleDeclareOptions['state']>, string | undefined>>

  for (const [state, declarations] of Object.entries(stateDeclarations)) {
    if (!declarations) {
      continue
    }

    const stateSelector = selectorForState(state as NonNullable<ModifierStyleDeclareOptions['state']>)

    style = ensureNestedSelector(style, selector, stateSelector, indentLevel, media)
    style = declareIntoNestedSelector(style, selector, stateSelector, declarations, indentLevel + 1, media)
  }

  return style
}

export async function declareModifierStyle(
  name: string,
  modifierName: string,
  options: ModifierStyleDeclareOptions = {},
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const media = options.media ?? DEFAULT_MEDIA
  const modifier = toKebabCase(modifierName)
  const value = options.value ? toKebabCase(options.value) : undefined
  const shorthandValue = modifierValueFromName(modifier)
  const baseModifier = shorthandValue ? 'variant' : modifier
  const selector = `&_${baseModifier}`
  const indent = media === 'desktop' ? 2 : 3

  if (!modifier) {
    throw new Error('Provide a modifier name')
  }

  if (shorthandValue) {
    throw new Error(
      `Do not create &_${modifier}. Use modifierName "variant" with --value "${shorthandValue}" so Starfront renders &_variant { &-${shorthandValue} { ... } }.`,
    )
  }

  let style = await readFile(files.style, 'utf8')

  style = ensureModifierSelector(style, info.name, selector, media)

  if (value) {
    style = ensureNestedSelector(style, selector, `&-${value}`, indent, media)
    style = declareIntoSelector(style, `&-${value}`, options.state ? undefined : options.base, indent + 1, media)
    style = declareStateStyles(style, `&-${value}`, options, indent + 1, media)
  } else {
    style = declareIntoSelector(style, selector, options.state ? undefined : options.base, indent, media)
    style = declareStateStyles(style, selector, options, indent, media)
  }

  await writeScssFile(files.style, style)
  return info
}

export async function deleteModifierStyle(
  name: string,
  modifierName: string,
  options: ModifierStyleDeleteOptions = {},
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const media = options.media ?? DEFAULT_MEDIA
  const modifier = toKebabCase(modifierName)
  const value = options.value ? toKebabCase(options.value) : undefined
  const shorthandValue = modifierValueFromName(modifier)
  const baseModifier = shorthandValue ? 'variant' : modifier
  const selector = `&_${baseModifier}`

  if (!modifier) {
    throw new Error('Provide a modifier name')
  }

  if (shorthandValue) {
    throw new Error(
      `Do not delete &_${modifier}. Use modifierName "variant" with --value "${shorthandValue}" so Starfront targets &_variant { &-${shorthandValue} { ... } }.`,
    )
  }

  let style = await readFile(files.style, 'utf8')

  if (value && options.state) {
    style = deleteStyleSelector(style, selectorForState(options.state), media, `&-${value}`)
  } else if (value) {
    style = deleteStyleSelector(style, `&-${value}`, media, selector)
  } else if (options.state) {
    style = deleteStyleSelector(style, selectorForState(options.state), media, selector)
  } else {
    style = deleteStyleSelector(style, selector, media)
  }

  await writeScssFile(files.style, style)
  return info
}
