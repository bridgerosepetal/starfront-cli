function renderPropLine(propName: string, type: string, optional: boolean): string {
  return `  ${propName}${optional ? '?' : ''}: ${type}`
}

function propLinePattern(propName: string): RegExp {
  return new RegExp(`^\\s*${propName}\\??\\s*:`, 'm')
}

export function ensurePropGroup(frontmatter: string, groupName: string, extendsType: string): string {
  if (new RegExp(`interface\\s+${groupName}\\b`).test(frontmatter)) {
    return frontmatter
  }

  return frontmatter.replace(/type\s+Props\s*=/, `interface ${groupName} extends ${extendsType} {\n}\n\ntype Props =`)
}

function propsGroups(frontmatter: string): string[] {
  return [...frontmatter.matchAll(/interface\s+([A-Z][A-Za-z0-9_]*Props)\b/g)].map(match => match[1])
}

export function ensurePropsUnion(frontmatter: string): string {
  const groups = propsGroups(frontmatter)

  if (!groups.length) {
    return frontmatter
  }

  return frontmatter.replace(/type\s+Props\s*=\s*[\s\S]*?&\s*{/, `type Props = (${groups.join(' | ')}) & {`)
}

export function insertInterfaceProp(
  frontmatter: string,
  groupName: string,
  propName: string,
  type: string,
  optional: boolean,
): string {
  const interfacePattern = new RegExp(`(interface\\s+${groupName}\\b[\\s\\S]*?{)([\\s\\S]*?)(\\n})`, 'm')
  const match = frontmatter.match(interfacePattern)

  if (!match) {
    throw new Error(`Prop group does not exist: ${groupName}`)
  }

  if (propLinePattern(propName).test(match[2])) {
    throw new Error(`Prop already exists in ${groupName}: ${propName}`)
  }

  return frontmatter.replace(interfacePattern, (_full, start: string, body: string, end: string) => {
    const nextBody = body.trimEnd()

    return `${start}${nextBody ? `${nextBody}\n` : '\n'}${renderPropLine(propName, type, optional)}${end}`
  })
}
