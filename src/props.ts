import { readFile, writeFile } from 'node:fs/promises'

import { joinAstro, splitAstro } from './astro/file.ts'
import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { runPropCreateHooks, runPropCreateValidationHooks } from './hooks.ts'
import { ensurePropGroup, ensurePropsUnion, insertInterfaceProp } from './prop-groups.ts'
import { type ComponentProp, parseProps } from './prop-parser.ts'
import { normalizeType } from './type-normalize.ts'
import type { ComponentInfo, PropCreateOptions } from './types.ts'
import { normalizeProjectRoot } from './utils/project.ts'

export { parseProps }
export type { ComponentProp }

function normalizeDefaultValue(type: string, defaultValue: string): string {
  if ((type.includes("'") || type.includes('"')) && !/^['"`]/.test(defaultValue)) {
    return `'${defaultValue}'`
  }

  return defaultValue
}

function renderPropLine(propName: string, type: string, optional: boolean): string {
  return `  ${propName}${optional ? '?' : ''}: ${type}`
}

function destructureProp(frontmatter: string, propName: string, defaultValue?: string): string {
  const binding = defaultValue === undefined ? propName : `${propName} = ${defaultValue}`
  const destructureMatch = frontmatter.match(/const\s*{([\s\S]*?)}\s*=\s*Astro\.props\s+as\s+Props/m)
  const destructureBody = destructureMatch?.[1] ?? ''

  if (new RegExp(`(?:^|,)\\s*${propName}(?:\\s*[=,:]|\\s*$)`).test(destructureBody)) {
    return frontmatter
  }

  return frontmatter.replace(/const\s*{\s*/, `const { ${binding}, `)
}

function ensureTypeImports(frontmatter: string, type: string): string {
  if (!type.includes('IconKey') || frontmatter.includes('import type { IconKey }')) {
    return frontmatter
  }

  return frontmatter.replace(
    /import type \{ HTMLAttributes \} from "astro\/types"\n/,
    `import type { HTMLAttributes } from "astro/types"\nimport type { IconKey } from "@shared/ui/icon/Icon.astro"\n`,
  )
}

export async function createPropGroup(
  componentName: string,
  groupName: string,
  extendsType: string,
  cwd?: string,
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const parts = splitAstro(await readFile(files.markup, 'utf8'))
  const normalizedExtendsType = normalizeType(extendsType)

  parts.frontmatter = ensurePropsUnion(ensurePropGroup(parts.frontmatter, groupName, normalizedExtendsType))

  await writeFile(files.markup, joinAstro(parts))
  return info
}

export async function createProp(
  componentName: string,
  propName: string,
  type: string,
  defaultValue?: string,
  options: PropCreateOptions = {},
): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(options.cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const code = await readFile(files.markup, 'utf8')
  const parts = splitAstro(code)
  const normalizedType = normalizeType(type, propName)
  const optional = options.optional ?? defaultValue !== undefined
  const normalizedDefault = defaultValue === undefined ? undefined : normalizeDefaultValue(normalizedType, defaultValue)

  if (options.group) {
    parts.frontmatter = insertInterfaceProp(parts.frontmatter, options.group, propName, normalizedType, optional)
    parts.frontmatter = ensurePropsUnion(parts.frontmatter)
  } else {
    runPropCreateValidationHooks({
      componentName,
      propName,
      props: parseProps(parts.frontmatter),
    })

    parts.frontmatter = parts.frontmatter.replace(
      /(type\s+Props\s*=[\s\S]*?&\s*{)([\s\S]*?)(\n})/m,
      (_match, start: string, body: string, end: string) =>
        `${start}${body.trimEnd()}\n${renderPropLine(propName, normalizedType, optional)}${end}`,
    )
  }

  if (options.destructure !== false) {
    parts.frontmatter = destructureProp(parts.frontmatter, propName, normalizedDefault)
  }

  parts.frontmatter = ensureTypeImports(parts.frontmatter, normalizedType)

  await writeFile(files.markup, joinAstro(parts))
  await runPropCreateHooks(componentName, propName, projectRoot)
  return info
}
