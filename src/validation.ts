import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { classValueFromAttributes, readMarkupRoot } from './markup/parse.ts'
import type { ComponentFiles, ComponentMarkupNode, MarkupNode, ValidationResult } from './types.ts'
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

  if (!existsSync(files.style)) {
    errors.push(`Missing SCSS file: ${relativeFiles.style}`)
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

function hasComponentStyleImport(astroCode: string, componentName: string): boolean {
  const escapedName = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`@use\\s+["']\\./${escapedName}\\.scss["']`)

  return pattern.test(astroCode)
}

export async function validateComponent(name: string, cwd?: string): Promise<ValidationResult> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const result = validateRequiredFiles(files, info.files)

  if (result.errors.length) {
    return result
  }

  const [astroCode, styleContent] = await Promise.all([readFile(files.markup, 'utf8'), readFile(files.style, 'utf8')])
  const root = await readMarkupRoot(astroCode, info.name)

  if (!root) {
    result.errors.push('Missing markup root')
  }

  if (root?.kind === 'element') {
    const classValue = classValueFromAttributes(root.attributes)

    if (!classValue.includes(info.name)) {
      result.errors.push(`Root must include BEM block class "${info.name}"`)
    }
  }

  if (!hasComponentStyleImport(astroCode, info.name)) {
    result.warnings.push('Astro file should import the component SCSS file')
  }

  if (!styleContent.includes(`.${info.name}`)) {
    result.errors.push(`SCSS file must declare ".${info.name}" block`)
  }

  for (const elementName of collectBemElements(root)) {
    const hasSelector =
      styleContent.includes(`&__${elementName}`) || styleContent.includes(`.${info.name}__${elementName}`)

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
