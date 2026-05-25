export function parseStyleSelectors(
  styleContent: string,
  blockName: string,
): {
  elements: string[]
  modifiers: string[]
} {
  const elements = new Set<string>()
  const modifiers = new Set<string>()

  for (const match of styleContent.matchAll(/&__([a-z0-9-]+)/gi)) {
    elements.add(match[1])
  }

  for (const match of styleContent.matchAll(/&_([a-z0-9-]+)/gi)) {
    modifiers.add(match[1])
  }

  const elementSelector = new RegExp(`\\.${blockName}__([a-z0-9-]+)`, 'gi')

  for (const match of styleContent.matchAll(elementSelector)) {
    elements.add(match[1])
  }

  return {
    elements: [...elements].sort(),
    modifiers: [...modifiers].sort(),
  }
}
