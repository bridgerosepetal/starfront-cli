import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buttonTemplateCommandSeries } from './button-commands.ts'
import { cleanupTempProjects, createTempProject, runStarfront } from './helpers.ts'

function normalizeLineEndings(content: string): string {
  return content.replaceAll('\r\n', '\n')
}

describe('button happy path', () => {
  afterEach(async () => {
    await cleanupTempProjects()
  })

  it('builds the MVP button through public commands', async () => {
    const projectRoot = await createTempProject()

    for (const args of buttonTemplateCommandSeries()) {
      runStarfront(projectRoot, args)
    }

    const [astro, scss, expectedAstro, expectedScss] = await Promise.all([
      readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8'),
      readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '..', 'examples', 'button', 'ButtonTemplate.astro'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '..', 'examples', 'button', 'button-template.scss'), 'utf8'),
    ])
    const validation = JSON.parse(runStarfront(projectRoot, ['ui', 'component', 'validate', 'button']))

    expect(normalizeLineEndings(astro)).toBe(normalizeLineEndings(expectedAstro))
    expect(normalizeLineEndings(scss)).toBe(normalizeLineEndings(expectedScss))
    expect(validation.valid).toBe(true)
  }, 15_000)

  it('rejects duplicate prop creation through public commands', async () => {
    const projectRoot = await createTempProject()

    runStarfront(projectRoot, ['ui', 'component', 'create', 'button'])
    runStarfront(projectRoot, ['ui', 'component', 'update', 'button', 'prop', 'create', 'tag', "'button' | 'a'", 'button'])

    expect(() =>
      runStarfront(projectRoot, ['ui', 'component', 'update', 'button', 'prop', 'create', 'tag', "'button' | 'a'"]),
    ).toThrow('Prop already exists: tag')

    const astro = await readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8')

    expect(astro.match(/\btag\??:/g)).toHaveLength(1)
    expect(astro.match(/const Tag: Props\["tag"] = tag \?\? 'button'/g)).toHaveLength(1)
  })

  it('creates the button template markup and styles through public commands', async () => {
    const projectRoot = await createTempProject()

    runStarfront(projectRoot, ['ui', 'component', 'create', 'button', 'button'])

    const [astro, scss, expectedAstro, expectedScss] = await Promise.all([
      readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8'),
      readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '..', 'examples', 'button', 'ButtonTemplate.astro'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '..', 'examples', 'button', 'button-template.scss'), 'utf8'),
    ])
    const validation = JSON.parse(runStarfront(projectRoot, ['ui', 'component', 'validate', 'button']))

    expect(normalizeLineEndings(astro)).toBe(normalizeLineEndings(expectedAstro))
    expect(normalizeLineEndings(scss)).toBe(normalizeLineEndings(expectedScss))
    expect(validation.valid).toBe(true)
  })
})
