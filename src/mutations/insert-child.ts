import type { MarkupNode } from '../types.ts'

function siblingMatches(node: MarkupNode, sibling: string): boolean {
  if (node.path === sibling) {
    return true
  }

  if (node.kind === 'element' && node.name === sibling) {
    return true
  }

  if (node.kind === 'component' && node.component === sibling) {
    return true
  }

  return node.kind === 'slot' && node.name === sibling
}

export function insertChild(
  parent: MarkupNode,
  child: MarkupNode,
  placement: 'append' | 'prepend',
  sibling?: string,
): void {
  if (!('children' in parent)) {
    throw new Error('Parent cannot have children')
  }

  if (!sibling) {
    if (placement === 'append') {
      parent.children.push(child)
    } else {
      parent.children.unshift(child)
    }

    return
  }

  const siblingIndex = parent.children.findIndex(node => siblingMatches(node, sibling))

  if (siblingIndex === -1) {
    throw new Error(`Sibling not found in parent: ${sibling}`)
  }

  parent.children.splice(placement === 'append' ? siblingIndex + 1 : siblingIndex, 0, child)
}
