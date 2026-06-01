import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { starfront } from '../index.ts'
import { createPropGroup } from '../props.ts'

import { cleanupTempProjects, createTempProject } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('prop concurrency', () => {
  it('serializes concurrent prop group and prop creation for one component', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button-kek', 'minimal', projectRoot)

    await Promise.all([
      createPropGroup('button-kek', 'ButtonProps', 'HTMLAttributes<"button">', projectRoot),
      createPropGroup('button-kek', 'AnchorProps', 'HTMLAttributes<"a">', projectRoot),
    ])

    const results = await Promise.allSettled([
      starfront.createProp('button-kek', 'href', 'string', undefined, {
        cwd: projectRoot,
        group: 'AnchorProps',
      }),
      starfront.createProp('button-kek', 'tag', 'a', undefined, {
        cwd: projectRoot,
        group: 'AnchorProps',
      }),
      starfront.createProp('button-kek', 'href', 'never', undefined, {
        cwd: projectRoot,
        group: 'ButtonProps',
      }),
      starfront.createProp('button-kek', 'color', 'green | white | opacity', 'green', {
        cwd: projectRoot,
      }),
      starfront.createProp('button-kek', 'tag', 'button | div | span', 'button', {
        cwd: projectRoot,
        group: 'ButtonProps',
      }),
      starfront.createProp('button-kek', 'variant', 'primary | baloon', 'primary', {
        cwd: projectRoot,
      }),
    ])
    const rejected = results.filter(result => result.status === 'rejected')
    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button-kek', 'ButtonKek.astro'), 'utf8')
    const props = await starfront.readComponent('button-kek', 'props', { cwd: projectRoot })

    expect(rejected).toHaveLength(0)
    expect(astro).toContain('interface ButtonProps')
    expect(astro).toContain('interface AnchorProps')
    expect(astro).toContain('variant?:')
    expect(astro).toContain('variant && `button-kek_variant-${variant}`')
    expect(astro).toContain('tag?:')
    expect(astro).toContain('const isLink: boolean = "href" in Astro.props')
    expect(astro).toContain('const Tag: Props["tag"] = isLink ? "a" : tag ? tag :')
    expect(props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'href', type: 'string' }),
        expect.objectContaining({ name: 'href', type: 'never' }),
        expect.objectContaining({ name: 'variant' }),
        expect.objectContaining({ name: 'color' }),
      ]),
    )
  })
})
