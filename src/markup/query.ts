import type { MarkupNode } from '../types.ts'

export function findNodeByPath(root: MarkupNode, pathValue: string): MarkupNode | null {
  if (root.path === pathValue) {
    return root
  }

  if (!('children' in root)) {
    return null
  }

  for (const child of root.children) {
    const found = findNodeByPath(child, pathValue)

    if (found) {
      return found
    }
  }

  return null
}

export function findElementByName(root: MarkupNode, name: string): MarkupNode | null {
  if ('name' in root && root.name === name) {
    return root
  }

  if (root.path === name) {
    return root
  }

  if (!('children' in root)) {
    return null
  }

  for (const child of root.children) {
    const found = findElementByName(child, name)

    if (found) {
      return found
    }
  }

  return null
}

export function limitDepth(node: MarkupNode, depth: number, currentDepth = 1): MarkupNode {
  if (!('children' in node) || currentDepth >= depth) {
    return { ...node, ...('children' in node ? { children: [] } : {}) }
  }

  return {
    ...node,
    children: node.children.map(child => limitDepth(child, depth, currentDepth + 1)),
  }
}
