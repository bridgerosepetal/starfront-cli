import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ComponentFiles, ComponentInfo } from '../types.ts'
import { assertComponentName, toPascalCase } from '../utils/naming.ts'
import { getUiRoot, normalizeProjectRoot, relative } from '../utils/project.ts'

import { renderButtonAstro, renderButtonScss } from './button-template.ts'
import { renderIndex, renderMinimalAstro, renderMinimalScss } from './templates.ts'

export async function resolveComponent(name: string, cwd?: string): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(cwd)
  const uiRoot = getUiRoot(projectRoot)
  const kebabName = assertComponentName(name)
  const dir = path.join(uiRoot, kebabName)
  const pascalName = toPascalCase(kebabName)
  let markupFile = path.join(dir, `${pascalName}.astro`)
  const styleFile = path.join(dir, `${kebabName}.scss`)
  const indexFile = path.join(dir, 'index.ts')

  if (!existsSync(markupFile) && existsSync(dir)) {
    const files = await readdir(dir)
    const astroFile = files.find(file => file.endsWith('.astro'))

    if (astroFile) {
      markupFile = path.join(dir, astroFile)
    }
  }

  return {
    name: kebabName,
    pascalName,
    dir,
    files: {
      markup: relative(projectRoot, markupFile),
      style: relative(projectRoot, styleFile),
      index: relative(projectRoot, indexFile),
    },
  }
}

export function absoluteFiles(info: ComponentInfo, cwd?: string): ComponentFiles {
  const projectRoot = normalizeProjectRoot(cwd)

  return {
    markup: path.join(projectRoot, info.files.markup),
    style: path.join(projectRoot, info.files.style),
    index: path.join(projectRoot, info.files.index),
  }
}

export async function listComponents(cwd?: string): Promise<ComponentInfo[]> {
  const projectRoot = normalizeProjectRoot(cwd)
  const uiRoot = getUiRoot(projectRoot)

  if (!existsSync(uiRoot)) {
    return []
  }

  const entries = await readdir(uiRoot, { withFileTypes: true })
  const components: ComponentInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const component = await resolveComponent(entry.name, projectRoot)
    const files = absoluteFiles(component, projectRoot)

    if (existsSync(files.markup)) {
      components.push(component)
    }
  }

  return components.sort((a, b) => a.name.localeCompare(b.name))
}

export async function createComponent(name: string, template = 'default', cwd?: string): Promise<ComponentInfo> {
  const projectRoot = normalizeProjectRoot(cwd)
  const info = await resolveComponent(name, projectRoot)
  const files = absoluteFiles(info, projectRoot)

  if (existsSync(info.dir)) {
    throw new Error(`Component already exists: ${info.name}`)
  }

  await mkdir(info.dir, { recursive: true })

  const normalizedTemplate = template.toLowerCase()

  if (!['default', 'minimal', 'button'].includes(normalizedTemplate)) {
    throw new Error(`Unknown template: ${template}`)
  }

  const astro = normalizedTemplate === 'button' ? renderButtonAstro(info) : renderMinimalAstro(info)
  const scss = normalizedTemplate === 'button' ? renderButtonScss(info.name) : renderMinimalScss(info.name)

  await writeFile(files.markup, astro)
  await writeFile(files.style, scss)
  await writeFile(files.index, renderIndex(info))

  return info
}

export async function deleteComponent(name: string, cwd?: string): Promise<ComponentInfo> {
  const info = await resolveComponent(name, cwd)

  if (!existsSync(info.dir)) {
    throw new Error(`Component does not exist: ${info.name}`)
  }

  await rm(info.dir, { recursive: true })
  return info
}
