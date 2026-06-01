import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { readMarkupRoot } from './markup/parse.ts'
import { assertScssBalancedBraces } from './scss.ts'
import { validateAstroTypeScript } from './typescript-validation.ts'
import type { ComponentFiles, ComponentMarkupNode, MarkupNode, ValidationResult } from './types.ts'
import { toKebabCase } from './utils/naming.ts'
import { normalizeProjectRoot } from './utils/project.ts'

function collectBemElements(root: MarkupNode | null): string[] {
  const elements = new Set<string>()

  function visit(node: MarkupNode | null): void {
    if (!node) {
      return
    }

    if (node.kind === 'element' && node.name) {
      elements.add(node.name)
    }

    if ('children' in node) {
      for (const child of node.children) {
        visit(child)
      }
    }
  }

  visit(root)
  return [...elements].sort()
}

function collectComponents(root: MarkupNode | null, componentName: string): ComponentMarkupNode[] {
  const components: ComponentMarkupNode[] = []

  function visit(node: MarkupNode | null): void {
    if (!node) {
      return
    }

    if (node.kind === 'component' && node.component === componentName) {
      components.push(node)
    }

    if ('children' in node) {
      for (const child of node.children) {
        visit(child)
      }
    }
  }

  visit(root)
  return components
}

function validateRequiredFiles(files: ComponentFiles, relativeFiles: ComponentFiles): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!existsSync(files.markup)) {
    errors.push(`Missing Astro file: ${relativeFiles.markup}`)
  }

  if (!existsSync(files.index)) {
    warnings.push(`Missing index file: ${relativeFiles.index}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

function componentNameFromAstroFile(markupFile: string): string {
  return toKebabCase(path.basename(markupFile, path.extname(markupFile)))
}

function hasComponentStyleImport(astroCode: string, componentName: string): boolean {
  const escapedName = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`@use\\s+["']\\./${escapedName}\\.scss["']`)

  return pattern.test(astroCode)
}

function validateRootClassList(root: MarkupNode | null, componentName: string): string[] {
  if (!root || (root.kind !== 'element' && root.kind !== 'component')) {
    return []
  }

  const attributes = root.kind === 'element' ? root.attributes : root.props
  const classListValue = attributes['class:list']
  const errors: string[] = []

  if (typeof classListValue !== 'string') {
    return ['Root must define class:list']
  }

  if (!classListValue.includes(componentName)) {
    errors.push(`Root class:list must include BEM block class "${componentName}"`)
  }

  if (!classListValue.includes('className')) {
    errors.push('Root class:list must include className')
  }

  return errors
}

export async function validateComponent(name: string, cwd?: string): Promise<ValidationResult> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const result = validateRequiredFiles(files, info.files)

  if (result.errors.length) {
    return result
  }

  const componentName = componentNameFromAstroFile(files.markup)
  const styleFile = path.join(path.dirname(files.markup), `${componentName}.scss`)
  const relativeStyleFile = path.relative(projectRoot, styleFile).replace(/\\/g, '/')

  if (!existsSync(styleFile)) {
    result.errors.push(`Missing SCSS file: ${relativeStyleFile}`)
    return {
      valid: false,
      errors: result.errors,
      warnings: result.warnings,
    }
  }

  const [astroCode, styleContent] = await Promise.all([readFile(files.markup, 'utf8'), readFile(styleFile, 'utf8')])
  const root = await readMarkupRoot(astroCode, componentName)
  result.errors.push(...validateAstroTypeScript(astroCode, files.markup, projectRoot, path.basename(files.markup, '.astro')))

  if (!root) {
    result.errors.push('Missing markup root')
  }

  result.errors.push(...validateRootClassList(root, componentName))

  if (!hasComponentStyleImport(astroCode, componentName)) {
    result.warnings.push('Astro file should import the component SCSS file')
  }

  if (!styleContent.includes(`.${componentName}`)) {
    result.errors.push(`SCSS file must declare ".${componentName}" block`)
  }

  try {
    assertScssBalancedBraces(styleContent)
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Invalid SCSS')
  }

  for (const elementName of collectBemElements(root)) {
    const hasSelector =
      styleContent.includes(`&__${elementName}`) || styleContent.includes(`.${componentName}__${elementName}`)

    if (!hasSelector) {
      result.warnings.push(`Markup element "${elementName}" has no matching SCSS selector`)
    }
  }

  for (const icon of collectComponents(root, 'Icon')) {
    if (!('name' in icon.props)) {
      result.warnings.push(`Icon at ${icon.path ?? 'unknown'} has no name prop`)
    }
  }

  return {
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
  }
}
