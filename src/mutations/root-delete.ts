import { ROOT_PATH } from '../constants.ts'
import type { MarkupNode, RootDeleteOptions } from '../types.ts'

import { readWritableRoot, writeWritableRoot } from './root.ts'

function removeChildByPathOrName(parent: MarkupNode, target: string): MarkupNode | null {
  if (!('children' in parent)) {
    return null
  }

  const childIndex = parent.children.findIndex(child => child.path === target || ('name' in child && child.name === target))

  if (childIndex !== -1) {
    const [removed] = parent.children.splice(childIndex, 1)
    return removed ?? null
  }

  for (const child of parent.children) {
    const removed = removeChildByPathOrName(child, target)

    if (removed) {
      return removed
    }
  }

  return null
}

export async function deleteRootNode(name: string, options: RootDeleteOptions): Promise<MarkupNode> {
  if (!options.node) {
    throw new Error('root delete requires --node')
  }

  if (options.node === ROOT_PATH) {
    throw new Error('Cannot delete the root node. Use root clear to remove root children.')
  }

  const writable = await readWritableRoot(name, options.cwd)
  const removed = removeChildByPathOrName(writable.root, options.node)

  if (!removed) {
    throw new Error(`Node not found: ${options.node}`)
  }

  await writeWritableRoot(writable.files, writable.parts, writable.root)

  return removed
}
