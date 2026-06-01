import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { starfront } from '../index.ts'

import { cleanupTempProjects, createTempProject } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('component TypeScript validation', () => {
  it('reports TypeScript errors during component validation', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)

    const astroPath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro')
    await writeFile(
      astroPath,
      (await readFile(astroPath, 'utf8')).replace(
        'const { class: className, ...props } = Astro.props as Props',
        'const { class: className, ...props } = Astro.props as Props\nconst invalidType: string = 123',
      ),
    )

    const result = await starfront.validateComponent('button', projectRoot)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'TypeScript error in Button.astro:9:7 - TS2322: Type \'number\' is not assignable to type \'string\'.',
    )
  })
})
