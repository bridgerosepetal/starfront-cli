import { readFile, writeFile } from 'node:fs/promises'

import { absoluteFiles, resolveComponent } from './repository.ts'
import { renderButtonAstro } from './button-template.ts'

function hasButtonTemplateProps(astro: string): boolean {
  return [
    "interface ButtonProps extends HTMLAttributes<'button'>",
    'tag?:',
    'href?: never',
    "interface AnchorProps extends HTMLAttributes<'a'>",
    'href: string',
    'variant?:',
    'contained',
    'text',
    'certificates',
    'color?:',
    'green',
    'white',
    'opacity',
    'iconStart?: IconKey',
    'iconEnd?: IconKey',
    'text?: string',
  ].every(part => astro.includes(part))
}

function hasButtonTemplateRoot(astro: string): boolean {
  return [
    '<Tag',
    '<slot>',
    'button__icon',
    'iconStart',
    'button__text',
    '{text}',
    'iconEnd',
    'Icon',
  ].every(part => astro.includes(part))
}

export async function canonicalizeButtonTemplate(name: string, cwd?: string): Promise<void> {
  if (name !== 'button') {
    return
  }

  const info = await resolveComponent(name, cwd)
  const files = absoluteFiles(info, cwd)
  const astro = await readFile(files.markup, 'utf8')

  if (!hasButtonTemplateProps(astro) || !hasButtonTemplateRoot(astro)) {
    return
  }

  const nextAstro = renderButtonAstro(info)

  if (astro !== nextAstro) {
    await writeFile(files.markup, nextAstro)
  }
}
