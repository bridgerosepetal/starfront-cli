import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { starfront } from '../index.ts'

import { cleanupTempProjects, createTempProject, runStarfront } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('BEM modifiers', () => {
  it('uses the actual component name for prop-driven modifier class:list hooks', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('cta-card', 'default', projectRoot)
    await starfront.createProp('cta-card', 'variant', "'primary' | 'secondary'", 'primary', {
      cwd: projectRoot,
    })
    await starfront.createProp('CtaCard', 'color', "'green' | 'white'", 'green', {
      cwd: projectRoot,
    })

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'cta-card', 'CtaCard.astro'), 'utf8')

    expect(astro).toContain('variant && `cta-card_variant-${variant}`')
    expect(astro).toContain('color && `cta-card_color-${color}`')
    expect(astro).not.toContain('button_variant')
    expect(astro).not.toContain('button_color')
  })

  it('declares BEM modifier styles through update grammar', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)
    runStarfront(projectRoot, [
      'ui',
      'component',
      'update',
      'button',
      'bem',
      'modifier',
      'style',
      'declare',
      'variant',
      '--value',
      'contained',
      '--base',
      'background: black; color: white;',
    ])

    const scss = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss'), 'utf8')

    expect(scss).toContain('&_variant')
    expect(scss).toContain('&-contained')
    expect(scss).toContain('background: black;')
    expect(scss).toContain('color: white;')
  })

  it('rejects flat variant value modifier selectors', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    expect(() =>
      runStarfront(projectRoot, [
        'ui',
        'component',
        'update',
        'button',
        'bem',
        'modifier',
        'style',
        'declare',
        'variant-primary',
        '--base',
        'background: black;',
      ]),
    ).toThrow('Do not create &_variant-primary')
  })
})
