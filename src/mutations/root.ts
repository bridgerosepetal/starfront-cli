import { readFile, writeFile } from 'node:fs/promises'

import { type AstroParts, joinAstro, splitAstro } from '../astro/file.ts'
import { absoluteFiles, resolveComponent } from '../components/repository.ts'
import { ROOT_PATH } from '../constants.ts'
import { readMarkupRoot } from '../markup/parse.ts'
import { findElementByName, findNodeByPath } from '../markup/query.ts'
import { renderMarkupNode } from '../markup/render.ts'
import type { AppendOptions, ComponentFiles, ComponentInfo, MarkupNode, RootSetOptions } from '../types.ts'
import { toKebabCase } from '../utils/naming.ts'
import { parseKeyValueList } from '../utils/parse.ts'
import { normalizeProjectRoot } from '../utils/project.ts'

import { insertChild } from './insert-child.ts'

type WritableRoot = {
  info: ComponentInfo
  files: ComponentFiles
  parts: AstroParts
  root: MarkupNode
}

export async function readWritableRoot(name: string, cwd?: string): Promise<WritableRoot> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const astroCode = await readFile(files.markup, 'utf8')
  const parts = splitAstro(astroCode)
  const root = await readMarkupRoot(astroCode, info.name)

  if (!root || !('children' in root)) {
    throw new Error(`Component has no writable root: ${info.name}`)
  }

  return { info, files, parts, root }
}

export async function writeWritableRoot(files: ComponentFiles, parts: AstroParts, root: MarkupNode): Promise<void> {
  clearExpressionRaw(root)
  await writeFile(files.markup, joinAstro({ ...parts, body: renderMarkupNode(root) }))
}

function clearExpressionRaw(node: MarkupNode): void {
  if (node.kind === 'expression') {
    delete node.raw
  }

  if ('children' in node) {
    for (const child of node.children) {
      clearExpressionRaw(child)
    }
  }
}

function createAppendNode(blockName: string, options: AppendOptions): MarkupNode {
  const attributes = parseKeyValueList(options.attr)
  const props = parseKeyValueList(options.prop, {
    bareIdentifiersAsExpressions: true,
  })
  const bemClass = options.bem ? `${blockName}__${toKebabCase(options.bem)}` : undefined

  if (options.component) {
    if (bemClass && !props.class) {
      props.class = bemClass
    }

    return { kind: 'component', component: options.component, props, children: [] }
  }

  if (!options.isSlot && options.slotName) {
    throw new Error('slotName requires isSlot: true')
  }

  if (options.isSlot) {
    const name = options.slotName || 'default'
    return { kind: 'slot', name, children: [] }
  }

  if (options.text !== undefined) {
    return { kind: 'text', value: options.text }
  }

  if (options.expression !== undefined) {
    return { kind: 'expression', expression: options.expression, children: [] }
  }

  if (!options.tag) {
    throw new Error('Provide one of --tag, --component, --is-slot, --text, or --expression')
  }

  if ((options.name || bemClass) && !attributes.class) {
    attributes.class = bemClass ?? `${blockName}__${toKebabCase(options.name ?? '')}`
  }

  return {
    kind: 'element',
    tag: options.tag,
    ...(options.name ? { name: toKebabCase(options.name) } : {}),
    attributes,
    ...(options.name ? { style: { mode: 'bem-element' } as const } : {}),
    children: [],
  }
}

function wrapCondition(node: MarkupNode, condition?: string): MarkupNode {
  if (!condition) {
    return node
  }

  return {
    kind: 'expression',
    expression: condition,
    children: [node],
  }
}

async function ensureComponentImport(files: ComponentFiles, parts: AstroParts, component?: string): Promise<void> {
  if (!component || parts.frontmatter.includes(` ${component} `)) {
    return
  }

  const importPath =
    component === 'Icon' ? '@shared/ui/icon/Icon.astro' : `@shared/ui/${toKebabCase(component)}/${component}.astro`

  parts.frontmatter = `import ${component} from "${importPath}"\n${parts.frontmatter}`
  await writeFile(files.markup, joinAstro(parts))
}

async function insertRootNode(
  name: string,
  options: AppendOptions,
  placement: 'append' | 'prepend',
): Promise<MarkupNode> {
  const writable = await readWritableRoot(name, options.cwd)
  const parentPath = options.node ?? ROOT_PATH
  const parent = findNodeByPath(writable.root, parentPath) ?? findElementByName(writable.root, parentPath)

  if (!parent || !('children' in parent)) {
    throw new Error(`Node not found or cannot have children: ${parentPath}`)
  }

  const child = wrapCondition(createAppendNode(writable.info.name, options), options.condition)
  ensureNoDuplicateSlot(writable.root, child)
  insertChild(parent, child, placement, options.sibling)
  await ensureComponentImport(writable.files, writable.parts, options.component)
  await writeWritableRoot(writable.files, writable.parts, writable.root)

  return child
}

export async function appendRootNode(name: string, options: AppendOptions = {}): Promise<MarkupNode> {
  return insertRootNode(name, options, 'append')
}

export async function prependRootNode(name: string, options: AppendOptions = {}): Promise<MarkupNode> {
  return insertRootNode(name, options, 'prepend')
}

function hasSlot(root: MarkupNode, slotName: string): boolean {
  if (root.kind === 'slot' && root.name === slotName) {
    return true
  }

  return 'children' in root && root.children.some(child => hasSlot(child, slotName))
}

function ensureNoDuplicateSlot(root: MarkupNode, node: MarkupNode): void {
  const slotName = node.kind === 'slot' ? node.name : undefined

  if (slotName && hasSlot(root, slotName)) {
    throw new Error(`Slot already exists: ${slotName}`)
  }
}

export async function clearRoot(name: string, cwd?: string): Promise<ComponentInfo> {
  const writable = await readWritableRoot(name, cwd)

  if (!('children' in writable.root)) {
    throw new Error(`Component has no writable root: ${name}`)
  }

  writable.root.children = []
  await writeWritableRoot(writable.files, writable.parts, writable.root)

  return writable.info
}

export async function setRoot(name: string, options: RootSetOptions): Promise<ComponentInfo> {
  const writable = await readWritableRoot(name, options.cwd)

  if (options.component) {
    writable.root = {
      kind: 'component',
      component: options.component,
      props: writable.root.kind === 'element' ? writable.root.attributes : {},
      children: 'children' in writable.root ? writable.root.children : [],
    }
  } else if (options.tag) {
    if (writable.root.kind !== 'element') {
      throw new Error('Only element roots can be changed to tags')
    }

    writable.root.tag = options.tag
  }

  await writeWritableRoot(writable.files, writable.parts, writable.root)
  return writable.info
}
