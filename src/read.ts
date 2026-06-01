import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

import { splitAstro } from './astro/file.ts'
import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { DEFAULT_MEDIA, SCHEMA_VERSION, SUPPORTED_MEDIA } from './constants.ts'
import { readMarkupRoot } from './markup/parse.ts'
import { findElementByName, findNodeByPath, limitDepth } from './markup/query.ts'
import { parseProps } from './props.ts'
import { assertScssBalancedBraces } from './scss.ts'
import { parseStyleSelectors } from './style-selectors.ts'
import type { MarkupNode, ReadOptions } from './types.ts'
import { normalizeProjectRoot } from './utils/project.ts'
import { validateComponent } from './validation.ts'

function selectRoot(root: MarkupNode | null, options: ReadOptions): MarkupNode | null {
  if (!root) {
    return null
  }

  const selected = options.element
    ? (findElementByName(root, options.element) ?? findNodeByPath(root, options.element))
    : root

  if (!selected) {
    return null
  }

  const depth = options.depth === undefined ? undefined : Number.parseInt(String(options.depth), 10)

  return depth !== undefined && Number.isFinite(depth) ? limitDepth(selected, depth) : selected
}

export async function readComponent(name: string, section = 'all', options: ReadOptions = {}): Promise<unknown> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)

  if (!existsSync(files.markup)) {
    throw new Error(`Component does not exist: ${info.name}`)
  }

  const [astroCode, styleContent] = await Promise.all([
    readFile(files.markup, 'utf8'),
    existsSync(files.style) ? readFile(files.style, 'utf8') : '',
  ])
  const parts = splitAstro(astroCode)
  const root = await readMarkupRoot(astroCode, info.name)
  const styleValidationErrors: string[] = []

  if (styleContent) {
    try {
      assertScssBalancedBraces(styleContent)
    } catch (error) {
      styleValidationErrors.push(error instanceof Error ? error.message : 'Invalid SCSS')
    }
  }

  const response = {
    schemaVersion: SCHEMA_VERSION,
    component: {
      name: info.name,
      kind: 'astro-component',
      files: info.files,
    },
    props: parseProps(parts.frontmatter),
    frontmatter: parts.frontmatter.trim(),
    markup: { root },
    styles: {
      language: 'scss',
      media: {
        default: DEFAULT_MEDIA,
        supported: SUPPORTED_MEDIA,
      },
      ...parseStyleSelectors(styleContent, info.name),
      raw: styleContent,
    },
    validation: await validateComponent(info.name, projectRoot),
  }

  switch (section) {
    case 'all':
      return response
    case 'component':
      return response.component
    case 'files':
      return response.component.files
    case 'props':
      return response.props
    case 'frontmatter':
      return response.frontmatter
    case 'markup':
      return response.markup
    case 'root':
      return selectRoot(root, options)
    case 'styles':
    case 'style':
      if (styleValidationErrors.length) {
        throw new Error(styleValidationErrors[0])
      }

      return response.styles
    case 'validation':
      return response.validation
    default:
      throw new Error(`Unknown read section: ${section}`)
  }
}
