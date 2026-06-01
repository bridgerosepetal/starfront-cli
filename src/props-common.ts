export function normalizeDefaultValue(type: string, defaultValue: string): string {
  if ((type.includes("'") || type.includes('"')) && !/^['"`]/.test(defaultValue)) {
    return `'${defaultValue}'`
  }

  return defaultValue
}

export function renderPropLine(propName: string, type: string, optional: boolean): string {
  return `  ${propName}${optional ? '?' : ''}: ${type}`
}

export function destructureProp(frontmatter: string, propName: string, defaultValue?: string): string {
  const binding = defaultValue === undefined ? propName : `${propName} = ${defaultValue}`
  const destructureMatch = frontmatter.match(/const\s*{([\s\S]*?)}\s*=\s*Astro\.props\s+as\s+Props/m)
  const destructureBody = destructureMatch?.[1] ?? ''

  if (new RegExp(`(?:^|,)\\s*${propName}(?:\\s*[=,:]|\\s*$)`).test(destructureBody)) {
    return frontmatter
  }

  return frontmatter.replace(/const\s*{\s*/, `const { ${binding}, `)
}

export function ensureTypeImports(frontmatter: string, type: string): string {
  if (!type.includes('IconKey') || frontmatter.includes('import type { IconKey }')) {
    return frontmatter
  }

  return frontmatter.replace(
    /import type \{ HTMLAttributes \} from "astro\/types"\n/,
    `import type { HTMLAttributes } from "astro/types"\nimport type { IconKey } from "@shared/ui/icon/Icon.astro"\n`,
  )
}
