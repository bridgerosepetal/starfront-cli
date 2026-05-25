import type { Node as AstroNode } from '@astrojs/compiler/types'

function indexFromPoint(source: string, line: number, column: number): number {
  const lineStarts = [0]
  const lineBreakPattern = /\r?\n/g
  let match: RegExpExecArray | null

  while ((match = lineBreakPattern.exec(source))) {
    lineStarts.push(match.index + match[0].length)
  }

  return (lineStarts[line - 1] ?? 0) + column - 1
}

export function sourceForExpression(node: AstroNode, source: string): string | undefined {
  const start = node.position?.start

  if (!start) {
    return undefined
  }

  const startIndex = source.indexOf('{', indexFromPoint(source, start.line, start.column))

  if (startIndex === -1) {
    return undefined
  }

  let depth = 0

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return undefined
}
