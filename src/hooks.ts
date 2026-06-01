import { readFile, writeFile } from 'node:fs/promises'

import { joinAstro, splitAstro } from './astro/file.ts'
import { absoluteFiles, resolveComponent } from './components/repository.ts'
import { ensureFrontmatterLine } from './frontmatter.ts'
import { readMarkupRoot } from './markup/parse.ts'
import { addRootClassListItem, setRootAttribute } from './mutations/root-attributes.ts'
import { setRoot } from './mutations/root.ts'
import { normalizeProjectRoot } from './utils/project.ts'

type PropCreateValidationContext = {
  componentName: string
  propName: string
  props: Array<{
    name: string
  }>
}

export function runPropCreateValidationHooks(context: PropCreateValidationContext): void {
  if (context.props.some(prop => prop.name === context.propName)) {
    throw new Error(`Prop already exists: ${context.propName}`)
  }
}

async function tagFallback(
  componentName: string,
  defaultValue: string | undefined,
  cwd?: string,
): Promise<string> {
  if (defaultValue) {
    return defaultValue
  }

  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const root = await readMarkupRoot(await readFile(files.markup, 'utf8'), info.name)

  return root?.kind === 'element' ? `"${root.tag}"` : '"div"'
}

async function hasTagResolver(componentName: string, cwd?: string): Promise<boolean> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const markup = await readFile(files.markup, 'utf8')

  return /\bconst\s+Tag\s*:/.test(markup)
}

async function frontmatterHasHrefProp(componentName: string, cwd?: string): Promise<boolean> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const parts = splitAstro(await readFile(files.markup, 'utf8'))

  return /\bhref\??\s*:/.test(parts.frontmatter)
}

async function ensureHrefTagResolver(
  componentName: string,
  fallback: string,
  cwd?: string,
): Promise<void> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(componentName, projectRoot)
  const files = absoluteFiles(info, projectRoot)
  const parts = splitAstro(await readFile(files.markup, 'utf8'))
  const tagResolver = `const Tag: Props["tag"] = isLink ? "a" : tag ? tag : ${fallback}`
  let frontmatter = parts.frontmatter
  const isLinkLine = 'const isLink: boolean = "href" in Astro.props'

  if (/\bconst\s+Tag\s*:\s*Props\["tag"]\s*=\s*.+/.test(frontmatter)) {
    frontmatter = frontmatter.replace(
      /\bconst\s+Tag\s*:\s*Props\["tag"]\s*=\s*.+/,
      `${frontmatter.includes(isLinkLine) ? '' : `${isLinkLine}\n`}${tagResolver}`,
    )
  } else {
    if (!frontmatter.includes(isLinkLine)) {
      frontmatter = `${frontmatter.trimEnd()}\n${isLinkLine}`
    }

    frontmatter = `${frontmatter.trimEnd()}\n${tagResolver}`
  }

  if (frontmatter !== parts.frontmatter) {
    await writeFile(files.markup, joinAstro({ ...parts, frontmatter }))
  }
}

export async function runPropCreateHooks(
  componentName: string,
  propName: string,
  defaultValue?: string,
  cwd?: string,
): Promise<void> {
  if (propName === 'tag' || propName === 'as') {
    const tagSource = propName === 'tag' ? 'tag' : 'as'
    const hasResolver = await hasTagResolver(componentName, cwd)
    const fallback = hasResolver ? undefined : await tagFallback(componentName, defaultValue, cwd)

    await setRoot(componentName, { cwd, component: 'Tag' })
    await setRootAttribute(componentName, {
      cwd,
      name: '...props as Record<string, unknown>',
    })

    if (tagSource === 'tag' && (await frontmatterHasHrefProp(componentName, cwd))) {
      await ensureHrefTagResolver(componentName, fallback ?? '"button"', cwd)
      return
    }

    if (hasResolver || !fallback) {
      return
    }

    await ensureFrontmatterLine(componentName, `const Tag: Props["${tagSource}"] = ${tagSource} ?? ${fallback}`, cwd)
  }

  if (propName === 'variant') {
    await addRootClassListItem(componentName, `variant && \`${componentName}_variant-\${variant}\``, cwd)
  }

  if (propName === 'color') {
    await addRootClassListItem(componentName, `color && \`${componentName}_color-\${color}\``, cwd)
  }

  if (propName === 'href' && (await hasTagResolver(componentName, cwd))) {
    await ensureHrefTagResolver(componentName, '"button"', cwd)
  }
}
