export type AstroParts = {
  frontmatter: string
  body: string
  style: string
}

export function splitAstro(code: string): AstroParts {
  const frontmatterMatch = code.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const frontmatter = frontmatterMatch?.[1] ?? ''
  const withoutFrontmatter = frontmatterMatch ? code.slice(frontmatterMatch[0].length) : code
  const styleMatch = withoutFrontmatter.match(/\r?\n?<style\b[\s\S]*?<\/style>\s*$/m)

  return {
    frontmatter,
    body: styleMatch ? withoutFrontmatter.slice(0, styleMatch.index).trim() : withoutFrontmatter.trim(),
    style: styleMatch?.[0].trim() ?? '',
  }
}

export function joinAstro(parts: AstroParts): string {
  const style = parts.style ? `\n\n${parts.style}` : ''
  return `---\n${parts.frontmatter.trim()}\n---\n\n${parts.body.trim()}\n${style}\n`
}
