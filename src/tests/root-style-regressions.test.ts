import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { starfront } from '../index.ts'
import { readMarkupRoot } from '../markup/parse.ts'
import { renderMarkupNode } from '../markup/render.ts'

import { cleanupTempProjects, createTempProject } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('root and style regressions', () => {
  it('deletes a root child by path and rejects deleting the root', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('panel', 'default', projectRoot)
    await starfront.appendRootNode('panel', {
      cwd: projectRoot,
      node: '1',
      tag: 'span',
      name: 'eyebrow',
    })

    await expect(starfront.deleteRootNode('panel', { cwd: projectRoot, node: '1' })).rejects.toThrow(
      'Cannot delete the root node',
    )

    const removed = await starfront.deleteRootNode('panel', { cwd: projectRoot, node: '1.2' })
    const root = await starfront.readComponent('panel', 'root', { cwd: projectRoot, depth: 3 })

    expect(removed).toMatchObject({ kind: 'element', name: 'eyebrow' })
    expect(JSON.stringify(root)).not.toContain('eyebrow')
  })

  it('updates style declarations without duplicating properties or state blocks', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'button', projectRoot)
    await starfront.declareBlockStyle('button', {
      cwd: projectRoot,
      base: 'background: white; transition: $transition',
      hover: 'background: black',
    })
    await starfront.declareBlockStyle('button', {
      cwd: projectRoot,
      base: 'background: #fff; color: #1f2a13',
      hover: 'background: #111; color: white',
    })
    await starfront.declareElementStyle('button', 'text', {
      cwd: projectRoot,
      media: 'mobile',
      base: 'font-size: 12px',
    })
    await starfront.declareElementStyle('button', 'text', {
      cwd: projectRoot,
      media: 'mobile',
      base: 'font-size: 11px; color: currentColor',
    })

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss'), 'utf8')

    expect(scss.match(/@include hover\(\)/g)).toHaveLength(1)
    expect(scss.match(/background:/g)).toHaveLength(2)
    expect(scss).toContain('background: #fff;')
    expect(scss).toContain('background: #111;')
    expect(scss).not.toContain('background: white;')
    expect(scss).not.toContain('background: black;')
    expect(scss.match(/font-size: 11px;/g)).toHaveLength(1)
    expect(scss).not.toContain('font-size: 12px;')
  })

  it('keeps button template media element declarations idempotent', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-lol', 'button', projectRoot)
    await starfront.declareElementStyle('button-lol', 'text', {
      cwd: projectRoot,
      media: 'tablet',
      base: 'font-size: 14px',
    })
    await starfront.declareElementStyle('button-lol', 'text', {
      cwd: projectRoot,
      media: 'mobile',
      base: 'font-size: 12px',
    })

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-lol', 'button-lol.scss'), 'utf8')

    expect(scss.match(/@media #\{media\("<", d\)\}/g)).toHaveLength(1)
    expect(scss.match(/@media #\{media\("<", m\)\}/g)).toHaveLength(1)
    expect(scss.match(/font-size: 14px;/g)).toHaveLength(1)
    expect(scss.match(/font-size: 12px;/g)).toHaveLength(1)
    expect(scss).not.toContain('font-size: 14px;\n}\n}')
  })

  it('does not treat media element selectors as desktop selectors', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'button', projectRoot)

    const stylePath = path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'button-kek.scss')
    const scssWithoutDesktopText = (await readFile(stylePath, 'utf8')).replace(
      /\n\n  &__text \{\n    font-size: 16px;\n    color: black;\n  \}/,
      '',
    )

    await writeFile(stylePath, scssWithoutDesktopText)
    await starfront.declareElementStyle('button-kek', 'text', {
      cwd: projectRoot,
      media: 'desktop',
      base: 'font-size: 16px',
    })

    const scss = await readFile(stylePath, 'utf8')
    const desktopBlock = scss.slice(scss.indexOf('.button-kek {'), scss.indexOf('@media #{media("<", d)}'))

    expect(desktopBlock).toContain('&__text {')
    expect(desktopBlock).toContain('font-size: 16px;')
    expect(scss).toContain('@media #{media("<", d)} {\n  .button-kek {\n    &__text {\n      font-size: 14px;')
    expect(scss).toContain('@media #{media("<", m)} {\n  .button-kek {\n    &__text {\n      font-size: 12px;')
  })

  it('rejects malformed SCSS instead of appending more declarations to it', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-lol', 'button', projectRoot)

    const stylePath = path.join(projectRoot, 'src', 'shared', 'ui', 'button-lol', 'button-lol.scss')
    const brokenScss = `${await readFile(stylePath, 'utf8')}font-size: 14px;\n}\n}\n`

    await writeFile(stylePath, brokenScss)

    await expect(
      starfront.declareElementStyle('button-lol', 'text', {
        cwd: projectRoot,
        media: 'mobile',
        base: 'font-size: 11px',
      }),
    ).rejects.toThrow('Invalid SCSS')

    await expect(readFile(stylePath, 'utf8')).resolves.toBe(brokenScss)
  })

  it('rejects reading the styles section when SCSS is malformed', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-lol', 'button', projectRoot)

    const stylePath = path.join(projectRoot, 'src', 'shared', 'ui', 'button-lol', 'button-lol.scss')
    await writeFile(stylePath, `${await readFile(stylePath, 'utf8')}}\n`)

    await expect(starfront.readComponent('button-lol', 'styles', { cwd: projectRoot })).rejects.toThrow(
      'Invalid SCSS',
    )
  })

  it('updates scss variables and modifier hover declarations idempotently', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'button', projectRoot)
    await starfront.declareBlockStyle('button-kek', {
      cwd: projectRoot,
      base: '$self: &; border: none; border-radius: 12px',
    })
    await starfront.declareBlockStyle('button-kek', {
      cwd: projectRoot,
      base: '$self: &; border: 0; border-radius: 12px',
    })
    await starfront.declareModifierStyle('button-kek', 'variant', {
      cwd: projectRoot,
      value: 'primary',
      base: 'background: #2ecc71; color: white',
      hover: 'background: #27ae60',
    })
    await starfront.declareModifierStyle('button-kek', 'variant', {
      cwd: projectRoot,
      value: 'primary',
      hover: 'background: #229954',
    })

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'button-kek.scss'), 'utf8')

    expect(scss.match(/\$self: &;/g)).toHaveLength(1)
    expect(scss.match(/border:/g)).toHaveLength(1)
    expect(scss).toContain('border: 0;')
    expect(scss.match(/&-primary/g)).toHaveLength(1)
    expect(scss.match(/@include hover\(\)/g)).toHaveLength(2)
    expect(scss).toContain('background: #229954;')
    expect(scss).not.toContain('background: #27ae60;')
  })

  it('keeps nested modifier value declarations balanced across repeated MCP-style calls', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'button', projectRoot)

    const calls = [
      {
        modifierName: 'variant',
        value: 'baloon',
        base: 'background: transparent; color: #1a8a4a; border: 2px solid #1a8a4a',
        hover: 'background: rgba(26, 138, 74, 0.08)',
      },
      {
        modifierName: 'color',
        value: 'green',
        base: 'background: #2ecc71; border-color: #2ecc71; color: white',
        hover: 'background: #27ae60; border-color: #27ae60',
      },
      {
        modifierName: 'color',
        value: 'white',
        base: 'background: white; border-color: #ddd; color: #333',
        hover: 'background: #f5f5f5; border-color: #ccc',
      },
      {
        modifierName: 'color',
        value: 'opacity',
        base: 'background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(4px)',
        hover: 'background: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.5)',
      },
    ]

    for (const call of calls) {
      await starfront.declareModifierStyle('button-kek', call.modifierName, {
        cwd: projectRoot,
        value: call.value,
        base: call.base,
        hover: call.hover,
      })
    }

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'button-kek.scss'), 'utf8')

    expect(scss.match(/&_variant/g)).toHaveLength(1)
    expect(scss.match(/&_color/g)).toHaveLength(1)
    expect(scss.match(/&-baloon/g)).toHaveLength(1)
    expect(scss.match(/&-green/g)).toHaveLength(1)
    expect(scss.match(/&-white/g)).toHaveLength(1)
    expect(scss.match(/&-opacity/g)).toHaveLength(1)
    expect(scss.match(/{/g)).toHaveLength(scss.match(/}/g)?.length ?? 0)
  })

  it('accepts nested selector fragments in block hover without corrupting media blocks', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'button', projectRoot)

    await starfront.declareModifierStyle('button-kek', 'variant', {
      cwd: projectRoot,
      value: 'text',
      base: 'background: transparent; color: #333; padding: 10px 16px',
    })
    await starfront.declareModifierStyle('button-kek', 'color', {
      cwd: projectRoot,
      value: 'white',
      base: 'background: #ffffff; color: #333; border: 1px solid #e0e0e0',
    })
    await starfront.declareBlockStyle('button-kek', {
      cwd: projectRoot,
      base: 'background: white; transition: $transition; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px',
      hover: 'background: black; #{$self}__text { color: white; }',
    })

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'button-kek.scss'), 'utf8')

    expect(scss).toContain('border: none;')
    expect(scss).toContain('cursor: pointer;')
    expect(scss).toContain('#{$self}__text')
    expect(scss.match(/@media #\{media\("<", m\)\}/g)).toHaveLength(1)
    expect(scss).not.toContain('\n {')
    expect(scss.match(/{/g)).toHaveLength(scss.match(/}/g)?.length ?? 0)
  })

  it('deletes nested element styles from block hover without recreating styles', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'button', projectRoot)
    await starfront.declareBlockStyle('button-kek', {
      cwd: projectRoot,
      hover: 'background: black; color: inherit; #{$self}__text { color: white; }',
    })
    await starfront.deleteElementStyle('button-kek', 'text', {
      cwd: projectRoot,
      state: 'hover',
    })

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'button-kek.scss'), 'utf8')

    expect(scss).toContain('@include hover()')
    expect(scss).toContain('background: black;')
    expect(scss).toContain('color: inherit;')
    expect(scss).not.toContain('#{$self}__text')
    expect(scss.match(/{/g)).toHaveLength(scss.match(/}/g)?.length ?? 0)
  })

  it('deletes modifier values and states without deleting the whole component', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'button', projectRoot)
    await starfront.declareModifierStyle('button-kek', 'variant', {
      cwd: projectRoot,
      value: 'contained',
      base: 'background: black; color: white',
      hover: 'background: #111',
    })
    await starfront.deleteModifierStyle('button-kek', 'variant', {
      cwd: projectRoot,
      value: 'contained',
      state: 'hover',
    })
    await starfront.deleteModifierStyle('button-kek', 'variant', {
      cwd: projectRoot,
      value: 'contained',
    })

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'button-kek.scss'), 'utf8')

    expect(scss).toContain('.button-kek {')
    expect(scss).toContain('&_variant {')
    expect(scss).not.toContain('&-contained')
    expect(scss).not.toContain('background: #111;')
    expect(scss.match(/{/g)).toHaveLength(scss.match(/}/g)?.length ?? 0)
  })

  it('parenthesizes rendered conditional wrappers', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)
    await starfront.appendRootNode('button', {
      cwd: projectRoot,
      node: '1',
      tag: 'span',
      name: 'icon-start',
      condition: "iconStart || Astro.slots.has('icon-start')",
    })

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro).toContain("(iconStart || Astro.slots.has('icon-start')) && (")
  })

  it('normalizes raw Astro expression indentation when re-rendering markup', async () => {
    const astro = `---\n---\n\n<Tag>\n  <slot>\n    {\n                                              (iconStart) && (\n                                              <span class="button-kek__icon"></span>\n                                              )\n                                            }\n  </slot>\n</Tag>\n`
    const root = await readMarkupRoot(astro, 'button-kek')

    expect(root ? renderMarkupNode(root) : '').toContain(
      '    {\n    (iconStart) && (\n    <span class="button-kek__icon"></span>\n    )\n    }',
    )
    expect(root ? renderMarkupNode(root) : '').not.toContain('                                              ')
  })

  it('can append a component inside a conditional BEM element', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'minimal', projectRoot)
    await starfront.createProp('button-kek', 'iconStart', 'IconKey', undefined, { cwd: projectRoot })
    await starfront.appendRootNode('button-kek', {
      cwd: projectRoot,
      node: '1',
      tag: 'span',
      name: 'icon',
      condition: 'iconStart',
    })
    await starfront.appendRootNode('button-kek', {
      cwd: projectRoot,
      node: 'icon',
      component: 'Icon',
      prop: ['name=iconStart'],
    })

    const astro = await readFile(
      path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'ButtonKek.astro'),
      'utf8',
    )

    expect(astro).toContain('(iconStart) && (')
    expect(astro).toContain('<span class="button-kek__icon">')
    expect(astro).toContain('<Icon name={iconStart}></Icon>')
  })
})
