import { afterEach, describe, expect, it } from 'vitest'

import { starfront } from '../index.ts'

import { cleanupTempProjects, createTempProject } from './helpers.ts'

afterEach(async () => {
  await cleanupTempProjects()
})

describe('starfront command vocabulary', () => {
  it('runs CLI-shaped commands through the public library API', async () => {
    const projectRoot = await createTempProject()

    const created = await starfront.runStarfrontCommand({
      cwd: projectRoot,
      command: 'starfront ui component create card minimal',
    })
    const listed = await starfront.runStarfrontCommand({
      cwd: projectRoot,
      args: ['ui', 'component', 'list'],
    })

    expect(created.command).toBe('starfront ui component create card minimal')
    expect(created.result).toMatchObject({ name: 'card' })
    expect(listed.result).toMatchObject([{ name: 'card' }])
  })

  it('rejects omitted ui namespace with a corrective command hint', async () => {
    await expect(
      starfront.runStarfrontCommand({
        command:
          'starfront component update button bem element style declare text --base "font-size: 16px; color: black"',
      }),
    ).rejects.toThrow(
      'Unsupported Starfront command: starfront component update button bem element style declare text --base "font-size: 16px; color: black". Use "starfront ui component ..." for component commands.',
    )
  })

  it('describes MCP tools with the UI namespace preserved', () => {
    expect(starfront.starfrontCommandReference.map(command => command.mcpTool)).toEqual([
      'ui_component_list',
      'ui_component_create',
      'ui_component_read',
      'ui_component_update',
      'ui_component_validate',
      'ui_component_delete',
    ])
  })
})
