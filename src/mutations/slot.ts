import { ROOT_PATH } from '../constants.ts'
import { findNodeByPath } from '../markup/query.ts'
import type { ComponentInfo, MarkupNode, SlotOptions } from '../types.ts'

import { appendRootNode, readWritableRoot, writeWritableRoot } from './root.ts'

function hasSlot(root: MarkupNode, slotName: string): boolean {
  if (root.kind === 'slot' && root.name === slotName) {
    return true
  }

  return 'children' in root && root.children.some(child => hasSlot(child, slotName))
}

function ensureNoDuplicateSlot(root: MarkupNode, slotName: string): void {
  if (hasSlot(root, slotName)) {
    throw new Error(`Slot already exists: ${slotName}`)
  }
}

export async function appendSlot(name: string, options: SlotOptions): Promise<MarkupNode> {
  const writable = await readWritableRoot(name, options.cwd)
  ensureNoDuplicateSlot(writable.root, options.name ?? 'default')

  return appendRootNode(name, {
    cwd: options.cwd,
    node: options.node ?? ROOT_PATH,
    slot: options.name ?? 'default',
  })
}

export async function wrapNodeWithSlot(name: string, options: SlotOptions): Promise<ComponentInfo> {
  const writable = await readWritableRoot(name, options.cwd)
  const node = findNodeByPath(writable.root, options.node ?? ROOT_PATH)

  if (!node || !('children' in node)) {
    throw new Error(`Node not found or cannot have children: ${options.node ?? ROOT_PATH}`)
  }

  const slotName = options.name ?? 'default'
  ensureNoDuplicateSlot(writable.root, slotName)
  node.children = [{ kind: 'slot', name: slotName, children: node.children }]
  await writeWritableRoot(writable.files, writable.parts, writable.root)
  return writable.info
}
