import type { ComponentInfo, MarkupNode, RootAttributeOptions } from '../types.ts'

import { readWritableRoot, writeWritableRoot } from './root.ts'

function rootAttributes(root: MarkupNode): Record<string, string | boolean> {
  if (root.kind === 'component') {
    return root.props
  }

  if (root.kind !== 'element') {
    throw new Error('Root attributes can only be changed on element or component roots')
  }

  return root.attributes
}

export async function setRootAttribute(name: string, options: RootAttributeOptions): Promise<ComponentInfo> {
  if (!options.name) {
    throw new Error('root attr set requires --name')
  }

  const writable = await readWritableRoot(name, options.cwd)
  const attributes = rootAttributes(writable.root)

  if (options.name.startsWith('...')) {
    for (const key of Object.keys(attributes)) {
      if (key.startsWith('...')) {
        delete attributes[key]
      }
    }
  }

  attributes[options.name] = options.value ?? true
  await writeWritableRoot(writable.files, writable.parts, writable.root)
  return writable.info
}

export async function addRootClassListItem(name: string, value: string, cwd?: string): Promise<ComponentInfo> {
  const writable = await readWritableRoot(name, cwd)
  const target = rootAttributes(writable.root)
  const current = typeof target['class:list'] === 'string' ? target['class:list'] : '{[]}'
  const inner = current.replace(/^\{/, '').replace(/\}$/, '').trim()

  if (!inner.includes(value)) {
    const body = inner.startsWith('[') && inner.endsWith(']') ? inner.slice(1, -1).trim() : inner
    const nextBody = body ? `${body},\n    ${value}` : value
    target['class:list'] = `{[\n    ${nextBody}\n  ]}`
  }

  await writeWritableRoot(writable.files, writable.parts, writable.root)
  return writable.info
}
