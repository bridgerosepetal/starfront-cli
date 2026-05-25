import { readFile, writeFile } from 'node:fs/promises'

import { joinAstro, splitAstro } from './astro/file.ts'
import { absoluteFiles, resolveComponent } from './components/repository.ts'
import type { ComponentInfo } from './types.ts'
import { normalizeProjectRoot } from './utils/project.ts'

export async function ensureFrontmatterLine(
  componentName: string,
  content: string,
  cwd?: string,
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const parts = splitAstro(await readFile(files.markup, 'utf8'))

  if (!parts.frontmatter.includes(content)) {
    parts.frontmatter = `${parts.frontmatter.trimEnd()}\n${content}`
    await writeFile(files.markup, joinAstro(parts))
  }

  return info
}
