import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { starfront } from '../index.ts'

import { cleanupTempProjects, createTempProject, runStarfront } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('starfront component MVP', () => {
  it('creates, updates, reads, styles, and validates a component', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-pretty', 'default', projectRoot)
    await starfront.createProp('button-pretty', 'iconStart', 'string', undefined, {
      cwd: projectRoot,
      optional: true,
    })
    await starfront.appendRootNode('button-pretty', {
      cwd: projectRoot,
      node: '1',
      tag: 'span',
      name: 'icon-start',
    })
    await starfront.appendRootNode('button-pretty', {
      cwd: projectRoot,
      node: '1',
      tag: 'span',
      name: 'text',
    })
    await starfront.appendRootNode('button-pretty', {
      cwd: projectRoot,
      node: 'icon-start',
      component: 'Icon',
      prop: ['name=iconStart'],
    })
    await starfront.ensureElementStyle('button-pretty', 'text', projectRoot)
    await starfront.declareElementStyle('button-pretty', undefined, {
      cwd: projectRoot,
      targets: 'icon-start,text',
      media: 'desktop',
      base: 'display: flex; width: 24px; height: 24px;',
    })

    const root = await starfront.readComponent('button-pretty', 'root', {
      cwd: projectRoot,
      depth: 3,
    })
    const validation = await starfront.validateComponent('button-pretty', projectRoot)
    const astro = await readFile(
      path.join(projectRoot, 'src', 'shared', 'ui', 'button-pretty', 'ButtonPretty.astro'),
      'utf8',
    )
    const scss = await readFile(
      path.join(projectRoot, 'src', 'shared', 'ui', 'button-pretty', 'button-pretty.scss'),
      'utf8',
    )

    expect(root).toMatchObject({
      kind: 'element',
      tag: 'div',
      children: [
        {
          kind: 'slot',
          name: 'default',
        },
        {
          kind: 'element',
          name: 'icon-start',
          children: [
            {
              kind: 'component',
              component: 'Icon',
            },
          ],
        },
        {
          kind: 'element',
          name: 'text',
        },
      ],
    })
    expect(validation).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    })
    expect(astro).toContain('{...props}')
    expect(astro).toContain('<Icon name={iconStart}></Icon>')
    expect(scss).toContain('&__icon-start')
    expect(scss).toContain('display: flex;')
  })

  it('supports the public CLI command grammar', async () => {
    const projectRoot = await createTempProject()
    const output = runStarfront(projectRoot, ['ui', 'component', 'create', 'button-pretty'])

    expect(JSON.parse(output)).toMatchObject({
      name: 'button-pretty',
      files: {
        markup: 'src/shared/ui/button-pretty/ButtonPretty.astro',
      },
    })
  })

  it('accepts single-quoted component SCSS imports during validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const astroPath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro')
    const astro = await readFile(astroPath, 'utf8')

    await writeFile(astroPath, astro.replace('@use "./button.scss" as *;', "@use './button.scss' as *;"))

    expect(await starfront.validateComponent('button', projectRoot)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    })
  })

  it('runs prop hooks for Tag roots and class:list variants', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)
    await starfront.createProp('button', 'tag', "'button' | 'a'", undefined, {
      cwd: projectRoot,
      optional: true,
    })
    await starfront.createProp('button', 'variant', "'contained' | 'text'", 'contained', {
      cwd: projectRoot,
    })

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro).toContain('const Tag: Props["tag"] = isLink ?')
    expect(astro).toContain('<Tag')
    expect(astro).toContain('{...props as Record<string, unknown>}')
    expect(astro).toContain('variant && `button_variant-${variant}`')
  })

  it('rejects duplicate prop creation before running prop hooks', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)
    await starfront.createProp('button', 'tag', "'button' | 'a'", undefined, {
      cwd: projectRoot,
      optional: true,
    })

    await expect(
      starfront.createProp('button', 'tag', "'button' | 'a'", undefined, {
        cwd: projectRoot,
        optional: true,
      }),
    ).rejects.toThrow('Prop already exists: tag')

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro.match(/\btag\??:/g)).toHaveLength(1)
    expect(astro.match(/const Tag: Props\["tag"] = isLink \? "a" : tag \? tag : "button"/g)).toHaveLength(1)
  })

  it('appends and wraps slots while rejecting duplicate slot names', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('panel', 'default', projectRoot)
    await expect(starfront.appendSlot('panel', { cwd: projectRoot, node: '1' })).rejects.toThrow(
      'Slot already exists: default',
    )

    await starfront.appendSlot('panel', { cwd: projectRoot, node: '1', name: 'footer' })
    await expect(starfront.wrapNodeWithSlot('panel', { cwd: projectRoot, node: '1', name: 'footer' })).rejects.toThrow(
      'Slot already exists: footer',
    )
  })
})
