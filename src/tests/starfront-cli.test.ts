import { readFile, rename, writeFile } from 'node:fs/promises'
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

  it('reports invalid SCSS during component validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const stylePath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss')
    await writeFile(stylePath, `${await readFile(stylePath, 'utf8')}\n}\n`)

    const result = await starfront.validateComponent('button', projectRoot)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid SCSS: unexpected closing brace at 16:1')
  })

  it('requires the root to use class:list during component validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const astroPath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro')
    const astro = await readFile(astroPath, 'utf8')

    await writeFile(astroPath, astro.replace('class:list={["button", className]}', 'class="button"'))

    const result = await starfront.validateComponent('button', projectRoot)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Root must define class:list')
  })

  it('requires class:list to contain the component block class during validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const astroPath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro')
    const astro = await readFile(astroPath, 'utf8')

    await writeFile(astroPath, astro.replace('class:list={["button", className]}', 'class:list={[className]}'))

    const result = await starfront.validateComponent('button', projectRoot)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Root class:list must include BEM block class "button"')
  })

  it('requires class:list to contain className during validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const astroPath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro')
    const astro = await readFile(astroPath, 'utf8')

    await writeFile(astroPath, astro.replace('class:list={["button", className]}', 'class:list={["button"]}'))

    const result = await starfront.validateComponent('button', projectRoot)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Root class:list must include className')
  })

  it('derives the component block name from the Astro filename during validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const componentDir = path.join(projectRoot, 'src', 'shared', 'ui', 'button')
    const astroPath = path.join(componentDir, 'Button.astro')
    const renamedAstroPath = path.join(componentDir, 'CardPanel.astro')
    const stylePath = path.join(componentDir, 'button.scss')
    const renamedStylePath = path.join(componentDir, 'card-panel.scss')
    const astro = await readFile(astroPath, 'utf8')
    const scss = await readFile(stylePath, 'utf8')

    await writeFile(
      astroPath,
      astro
        .replace('export { Button }', 'export { CardPanel }')
        .replace('class:list={["button", className]}', 'class:list={["card-panel", className]}')
        .replace('@use "./button.scss" as *;', '@use "./card-panel.scss" as *;'),
    )
    await writeFile(stylePath, scss.replace('.button', '.card-panel'))
    await rename(astroPath, renamedAstroPath)
    await rename(stylePath, renamedStylePath)

    expect(await starfront.validateComponent('button', projectRoot)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    })
  })

  it('requires the SCSS filename to match the Astro filename during validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const componentDir = path.join(projectRoot, 'src', 'shared', 'ui', 'button')
    const astroPath = path.join(componentDir, 'Button.astro')
    const renamedAstroPath = path.join(componentDir, 'CardPanel.astro')

    await rename(astroPath, renamedAstroPath)

    const result = await starfront.validateComponent('button', projectRoot)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing SCSS file: src/shared/ui/button/card-panel.scss')
  })

  it('runs prop hooks for Tag roots and class:list variants', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)
    await starfront.createProp('button', 'tag', "'button' | 'a'", 'button', {
      cwd: projectRoot,
      optional: true,
    })
    await starfront.createProp('button', 'variant', "'contained' | 'text'", 'contained', {
      cwd: projectRoot,
    })

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro).toContain('const Tag: Props["tag"] = tag ?? \'button\'')
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
    expect(astro.match(/const Tag: Props\["tag"] = tag \?\? "div"/g)).toHaveLength(1)
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
