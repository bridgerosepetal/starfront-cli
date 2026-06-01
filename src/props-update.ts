import { readFile, writeFile } from 'node:fs/promises'

import { joinAstro, splitAstro } from './astro/file.ts'
import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { findPropSignature, parseProps } from './prop-parser.ts'
import { destructureProp, ensureTypeImports, normalizeDefaultValue, renderPropLine } from './props-common.ts'
import { normalizeType } from './type-normalize.ts'
import type { ComponentInfo, PropDeleteOptions, PropUpdateOptions } from './types.ts'
import { normalizeProjectRoot } from './utils/project.ts'

function removeDestructuredProp(frontmatter: string, propName: string): string {
  const destructureMatch = frontmatter.match(/const\s*{([\s\S]*?)}\s*=\s*Astro\.props\s+as\s+Props/m)

  if (destructureMatch?.index === undefined) {
    return frontmatter
  }

  const entries = destructureMatch[1]
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .filter(entry => {
      const normalized = entry.replace(/^class:\s*className$/, 'class')

      return !new RegExp(`^${propName}(?:\\s*[=:]|$)`).test(normalized)
    })

  return `${frontmatter.slice(0, destructureMatch.index)}const { ${entries.join(', ')} } = Astro.props as Props${frontmatter.slice(
    destructureMatch.index + destructureMatch[0].length,
  )}`
}

function replacePropSignature(
  frontmatter: string,
  propName: string,
  nextLine: string | undefined,
  group?: string,
): string {
  const signature = findPropSignature(frontmatter, propName, group)

  if (!signature) {
    throw new Error(`Prop does not exist: ${propName}`)
  }

  if (signature.ambiguous) {
    throw new Error(`Prop exists in multiple groups: ${propName}. Provide --group.`)
  }

  const lineStart = frontmatter.lastIndexOf('\n', signature.start) + 1
  const lineEnd = frontmatter.indexOf('\n', signature.end)
  const replaceEnd = lineEnd === -1 ? signature.end : lineEnd

  return `${frontmatter.slice(0, lineStart)}${nextLine ?? ''}${frontmatter.slice(replaceEnd)}`
}

export async function updateProp(
  componentName: string,
  propName: string,
  options: PropUpdateOptions = {},
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const parts = splitAstro(await readFile(files.markup, 'utf8'))
  const current = parseProps(parts.frontmatter).find(prop => prop.name === propName)

  if (!current) {
    throw new Error(`Prop does not exist: ${propName}`)
  }

  const normalizedType = normalizeType(options.type ?? current.type, propName)
  const defaultValue = options.defaultValue
  const optional = options.optional ?? (defaultValue !== undefined || current.optional)
  const normalizedDefault = defaultValue === undefined ? undefined : normalizeDefaultValue(normalizedType, defaultValue)

  parts.frontmatter = replacePropSignature(
    parts.frontmatter,
    propName,
    renderPropLine(propName, normalizedType, optional),
    options.group,
  )

  if (options.destructure === false) {
    parts.frontmatter = removeDestructuredProp(parts.frontmatter, propName)
  } else {
    parts.frontmatter = destructureProp(
      removeDestructuredProp(parts.frontmatter, propName),
      propName,
      normalizedDefault,
    )
  }

  parts.frontmatter = ensureTypeImports(parts.frontmatter, normalizedType)
  await writeFile(files.markup, joinAstro(parts))
  return info
}

export async function deleteProp(
  componentName: string,
  propName: string,
  options: PropDeleteOptions = {},
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const parts = splitAstro(await readFile(files.markup, 'utf8'))

  parts.frontmatter = replacePropSignature(parts.frontmatter, propName, undefined, options.group)
  parts.frontmatter = removeDestructuredProp(parts.frontmatter, propName)

  await writeFile(files.markup, joinAstro(parts))
  return info
}
