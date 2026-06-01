import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempProjects, createTempProject, runStarfront } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('prop update and delete', () => {
  it('updates and deletes props through canonical update grammar', async () => {
    const projectRoot = await createTempProject()

    runStarfront(projectRoot, ['ui', 'component', 'create', 'button'])
    runStarfront(projectRoot, ['ui', 'component', 'update', 'button', 'prop', 'create', 'tone', 'primary | secondary'])
    runStarfront(projectRoot, [
      'ui',
      'component',
      'update',
      'button',
      'prop',
      'update',
      'tone',
      'primary | secondary | ghost',
      'primary',
    ])

    let astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro).toContain("tone?: 'primary' | 'secondary' | 'ghost'")
    expect(astro).toContain("tone = 'primary'")

    runStarfront(projectRoot, ['ui', 'component', 'update', 'button', 'prop', 'delete', 'tone'])
    astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro).not.toContain('tone?:')
    expect(astro).not.toContain('tone =')
  })

  it('keeps rest destructuring valid after deleting props', async () => {
    const projectRoot = await createTempProject()

    runStarfront(projectRoot, ['ui', 'component', 'create', 'button', 'button'])
    runStarfront(projectRoot, ['ui', 'component', 'update', 'button', 'prop', 'delete', 'variant'])
    runStarfront(projectRoot, ['ui', 'component', 'update', 'button', 'prop', 'delete', 'color'])

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')
    const validation = JSON.parse(runStarfront(projectRoot, ['ui', 'component', 'validate', 'button']))

    expect(astro).toContain('text, ...props } = Astro.props as Props')
    expect(astro).not.toContain('...props,')
    expect(validation.valid).toBe(true)
  })
})
