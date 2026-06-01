import { afterEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { starfront } from '../index.ts'
import { registerComponentTools } from '../mcp/component-tools.ts'
import { createMcpCommandLogger } from '../mcp/log.ts'
import { registerMetaTools } from '../mcp/meta-tools.ts'
import type { McpToolContext } from '../mcp/tool-context.ts'

import { buttonTemplateCommandSeries } from './button-commands.ts'
import { cleanupTempProjects, createTempProject } from './helpers.ts'

type ToolResult = { content: [{ text: string }] }
type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>

afterEach(async () => {
  await cleanupTempProjects()
})

function normalizeLineEndings(content: string): string {
  return content.replaceAll('\r\n', '\n')
}

function createContext(projectRoot = process.cwd()): McpToolContext {
  return {
    getProjectRoot: () => projectRoot,
    setProjectRoot: () => undefined,
    useProjectRoot: () => projectRoot,
    commandLogger: {
      entries: () => [],
      record: async ({ run }) => run(),
      undo: async () => {
        throw new Error('No command to undo')
      },
      redo: async () => {
        throw new Error('No command to redo')
      },
    },
  }
}

function createRecordingContext(records: string[][], projectRoot = process.cwd()): McpToolContext {
  return {
    getProjectRoot: () => projectRoot,
    setProjectRoot: () => undefined,
    useProjectRoot: () => projectRoot,
    commandLogger: {
      entries: () => [],
      undo: async () => {
        throw new Error('No command to undo')
      },
      redo: async () => {
        throw new Error('No command to redo')
      },
      async record<T>({
        args,
      }: {
        projectRoot: string
        tool: string
        args: string[]
        run: () => Promise<T>
      }): Promise<T> {
        records.push(args)
        return { ok: true } as T
      },
    },
  }
}

function registeredHandlers(context: McpToolContext): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>()
  const server = {
    registerTool: (name: string, _definition: unknown, handler: ToolHandler) => {
      handlers.set(name, handler)
    },
  }

  registerComponentTools(server as never, context)
  return handlers
}

function registeredMetaHandlers(context: McpToolContext): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>()
  const server = {
    registerTool: (name: string, _definition: unknown, handler: ToolHandler) => {
      handlers.set(name, handler)
    },
  }

  registerMetaTools(server as never, context)
  return handlers
}

function parseMcpUpdateArgs(args: string[]): { name: string; tokens: string[]; options: Record<string, unknown> } {
  const name = args[3]
  const tokens: string[] = []
  const options: Record<string, unknown> = {}

  for (let index = 4; index < args.length; index += 1) {
    const arg = args[index]

    if (!arg.startsWith('--')) {
      tokens.push(arg)
      continue
    }

    switch (arg) {
      case '--required':
        options.required = true
        break
      case '--no-destructure':
        options.destructure = false
        break
      case '--is-slot':
        options.isSlot = true
        break
      case '--prop':
      case '--attr': {
        const key = arg.slice(2)
        options[key] = [...((options[key] as string[] | undefined) ?? []), args[index + 1]]
        index += 1
        break
      }
      default: {
        const key = arg.slice(2).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
        options[key] = args[index + 1]
        index += 1
        break
      }
    }
  }

  return { name, tokens, options }
}

async function runMcpComponentCommand(handlers: Map<string, ToolHandler>, args: string[]): Promise<void> {
  if (args[2] === 'create') {
    await handlers.get('ui_component_create')?.({ name: args[3], template: args[4] })
    return
  }

  if (args[2] !== 'update') {
    throw new Error(`Unsupported MCP test command: ${args.join(' ')}`)
  }

  const { name, tokens, options } = parseMcpUpdateArgs(args)

  await handlers.get('ui_component_update')?.({ name, tokens, options })
}

describe('Starfront MCP tools', () => {
  it('exposes dedicated BEM element and modifier tools', () => {
    const tools: string[] = []
    const server = {
      registerTool: (name: string) => {
        tools.push(name)
      },
    }

    registerComponentTools(server as never, createContext())

    expect(tools).toContain('ui_component_bem_block_style_declare')
    expect(tools).toContain('ui_component_bem_block_style_delete')
    expect(tools).toContain('ui_component_bem_element_style_declare')
    expect(tools).toContain('ui_component_bem_element_style_delete')
    expect(tools).toContain('ui_component_bem_modifier_classlist_add')
    expect(tools).toContain('ui_component_bem_modifier_style_declare')
    expect(tools).toContain('ui_component_bem_modifier_style_delete')
    expect(tools).toContain('ui_component_prop_update')
    expect(tools).toContain('ui_component_prop_delete')
    expect(tools).toContain('ui_component_root_append')
    expect(tools).toContain('ui_component_root_classlist_add')
    expect(tools).not.toContain('ui_component_bem_element_append')
    expect(tools).not.toContain('ui_component_style_declare')
  })

  it('exposes command undo and redo meta tools', () => {
    const tools: string[] = []
    const server = {
      registerTool: (name: string) => {
        tools.push(name)
      },
    }

    registerMetaTools(server as never, createContext())

    expect(tools).toContain('command_undo')
    expect(tools).toContain('command_redo')
  })

  it('undoes and redoes MCP component writes from stored snapshots', async () => {
    const projectRoot = await createTempProject()
    const commandLogger = createMcpCommandLogger()
    let activeProjectRoot = projectRoot
    const context: McpToolContext = {
      getProjectRoot: () => activeProjectRoot,
      setProjectRoot: nextProjectRoot => {
        activeProjectRoot = nextProjectRoot
      },
      useProjectRoot: nextProjectRoot => {
        activeProjectRoot = nextProjectRoot ?? activeProjectRoot
        return activeProjectRoot
      },
      commandLogger,
    }
    const componentHandlers = registeredHandlers(context)
    const metaHandlers = registeredMetaHandlers(context)

    await componentHandlers.get('ui_component_create')?.({ name: 'button' })
    await componentHandlers.get('ui_component_root_append')?.({
      name: 'button',
      node: '1',
      tag: 'span',
      elementName: 'text',
    })

    let root = await starfront.readComponent('button', 'root', { cwd: projectRoot, depth: 3 })
    expect(JSON.stringify(root)).toContain('text')

    await metaHandlers.get('command_undo')?.({})
    root = await starfront.readComponent('button', 'root', { cwd: projectRoot, depth: 3 })
    expect(JSON.stringify(root)).not.toContain('text')

    await metaHandlers.get('command_redo')?.({})
    root = await starfront.readComponent('button', 'root', { cwd: projectRoot, depth: 3 })
    expect(JSON.stringify(root)).toContain('text')
  })

  it('undoes only the component touched by an MCP write', async () => {
    const projectRoot = await createTempProject()
    const commandLogger = createMcpCommandLogger()
    const context = createContext(projectRoot)
    context.commandLogger = commandLogger
    const componentHandlers = registeredHandlers(context)
    const metaHandlers = registeredMetaHandlers(context)

    await componentHandlers.get('ui_component_create')?.({ name: 'button' })
    await starfront.createComponent('card', 'default', projectRoot)
    await metaHandlers.get('command_undo')?.({})

    expect(existsSync(path.join(projectRoot, 'src', 'shared', 'ui', 'button'))).toBe(false)
    expect(existsSync(path.join(projectRoot, 'src', 'shared', 'ui', 'card'))).toBe(true)
  })

  it('rolls back file mutations when an MCP write command fails', async () => {
    const projectRoot = await createTempProject()
    const commandLogger = createMcpCommandLogger()

    await starfront.createComponent('button', 'default', projectRoot)

    const stylePath = path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss')
    const before = await readFile(stylePath, 'utf8')

    await expect(
      commandLogger.record({
        projectRoot,
        tool: 'ui_component_bem_modifier_style_declare',
        args: ['ui', 'component', 'update', 'button', 'bem', 'modifier', 'style', 'declare', 'color'],
        run: async () => {
          await writeFile(stylePath, `${before}}\n`)
          throw new Error('simulated failure after partial write')
        },
      }),
    ).rejects.toThrow('simulated failure')

    await expect(readFile(stylePath, 'utf8')).resolves.toBe(before)
  })

  it('warns when root append BEM element input looks like a modifier', async () => {
    const projectRoot = await createTempProject()

    await starfront.createComponent('button', 'default', projectRoot)
    const handlers = registeredHandlers(createContext(projectRoot))

    const result = await handlers.get('ui_component_root_append')?.({
      name: 'button',
      node: '1',
      tag: 'span',
      elementName: '__variant',
    })

    expect(result).toBeDefined()
    expect(JSON.parse(result?.content[0].text ?? '{}').warnings[0]).toContain('looks like a root modifier')
  })

  it('maps structured write tools to one canonical CLI command each', async () => {
    const records: string[][] = []
    const handlers = registeredHandlers(createRecordingContext(records))

    await handlers.get('ui_component_create')?.({ name: 'button', template: 'minimal' })
    await handlers.get('ui_component_update')?.({ name: 'button', tokens: ['root', 'clear'], options: {} })
    await handlers.get('ui_component_prop_group_create')?.({
      name: 'button',
      groupName: 'ButtonProps',
      extends: 'HTMLAttributes<button>',
    })
    await handlers.get('ui_component_prop_create')?.({ name: 'button', propName: 'variant', type: 'contained | text' })
    await handlers.get('ui_component_prop_update')?.({ name: 'button', propName: 'variant', type: 'primary | text' })
    await handlers.get('ui_component_prop_delete')?.({ name: 'button', propName: 'variant' })
    await handlers.get('ui_component_root_append')?.({ name: 'button', node: '1', tag: 'span', elementName: 'text' })
    await handlers.get('ui_component_root_append')?.({ name: 'button', node: '1', isSlot: true })
    await handlers.get('ui_component_root_append')?.({ name: 'button', node: '1', isSlot: true, slotName: 'footer' })
    await handlers.get('ui_component_root_classlist_add')?.({ name: 'button', value: 'isActive && "button_active"' })
    await handlers.get('ui_component_bem_modifier_classlist_add')?.({ name: 'button', modifierName: 'variant' })
    await handlers.get('ui_component_bem_block_style_declare')?.({ name: 'button', base: 'display: flex' })
    await handlers.get('ui_component_bem_block_style_delete')?.({ name: 'button', state: 'hover' })
    await handlers.get('ui_component_bem_element_style_declare')?.({ name: 'button', elementName: 'text' })
    await handlers.get('ui_component_bem_element_style_delete')?.({ name: 'button', elementName: 'text' })
    await handlers.get('ui_component_bem_modifier_style_declare')?.({
      name: 'button',
      modifierName: 'variant',
      value: 'contained',
    })
    await handlers.get('ui_component_bem_modifier_style_delete')?.({
      name: 'button',
      modifierName: 'variant',
      value: 'contained',
    })
    await handlers.get('ui_component_root_delete')?.({ name: 'button', node: '1.2' })
    await handlers.get('ui_component_validate')?.({ name: 'button' })
    await handlers.get('ui_component_delete')?.({ name: 'button' })

    expect(records).toEqual([
      ['ui', 'component', 'create', 'button', 'minimal'],
      ['ui', 'component', 'update', 'button', 'root', 'clear'],
      [
        'ui',
        'component',
        'update',
        'button',
        'prop',
        'group',
        'create',
        'ButtonProps',
        '--extends',
        'HTMLAttributes<button>',
      ],
      ['ui', 'component', 'update', 'button', 'prop', 'create', 'variant', 'contained | text'],
      ['ui', 'component', 'update', 'button', 'prop', 'update', 'variant', 'primary | text'],
      ['ui', 'component', 'update', 'button', 'prop', 'delete', 'variant'],
      ['ui', 'component', 'update', 'button', 'root', 'append', '--node', '1', '--tag', 'span', '--name', 'text'],
      ['ui', 'component', 'update', 'button', 'root', 'append', '--node', '1', '--is-slot'],
      ['ui', 'component', 'update', 'button', 'root', 'append', '--node', '1', '--is-slot', '--slot-name', 'footer'],
      ['ui', 'component', 'update', 'button', 'root', 'classlist', 'add', '--value', 'isActive && "button_active"'],
      [
        'ui',
        'component',
        'update',
        'button',
        'bem',
        'modifier',
        'classlist',
        'add',
        'variant',
        '--prop-name',
        'variant',
      ],
      ['ui', 'component', 'update', 'button', 'bem', 'block', 'style', 'declare', '--base', 'display: flex'],
      ['ui', 'component', 'update', 'button', 'bem', 'block', 'style', 'delete', '--state', 'hover'],
      ['ui', 'component', 'update', 'button', 'bem', 'element', 'style', 'declare', 'text'],
      ['ui', 'component', 'update', 'button', 'bem', 'element', 'style', 'delete', 'text'],
      ['ui', 'component', 'update', 'button', 'bem', 'modifier', 'style', 'declare', 'variant', '--value', 'contained'],
      ['ui', 'component', 'update', 'button', 'bem', 'modifier', 'style', 'delete', 'variant', '--value', 'contained'],
      ['ui', 'component', 'update', 'button', 'root', 'delete', '--node', '1.2'],
      ['ui', 'component', 'validate', 'button'],
      ['ui', 'component', 'delete', 'button'],
    ])
  })

  it('rejects slotName unless root append explicitly asks for a slot', async () => {
    const handlers = registeredHandlers(createRecordingContext([]))

    await expect(
      handlers.get('ui_component_root_append')?.({ name: 'button', node: '1', slotName: 'footer' }),
    ).rejects.toThrow('slotName requires isSlot: true')
  })

  it('maps generic update isSlot and slotName options to the CLI slot flags', async () => {
    const records: string[][] = []
    const handlers = registeredHandlers(createRecordingContext(records))

    await handlers.get('ui_component_update')?.({
      name: 'button',
      tokens: ['root', 'append'],
      options: { node: '1', isSlot: true, slotName: 'footer' },
    })

    expect(records).toEqual([
      ['ui', 'component', 'update', 'button', 'root', 'append', '--node', '1', '--is-slot', '--slot-name', 'footer'],
    ])
  })

  it('builds the button happy path through MCP component tools', async () => {
    const projectRoot = await createTempProject()
    const handlers = registeredHandlers(createContext(projectRoot))

    for (const args of buttonTemplateCommandSeries()) {
      await runMcpComponentCommand(handlers, args)
    }

    const [astro, scss, expectedAstro, expectedScss] = await Promise.all([
      readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'Button.astro'), 'utf8'),
      readFile(path.join(projectRoot, 'src', 'shared', 'ui', 'button', 'button.scss'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '..', 'examples', 'button', 'ButtonTemplate.astro'), 'utf8'),
      readFile(path.resolve(import.meta.dirname, '..', 'examples', 'button', 'button-template.scss'), 'utf8'),
    ])
    const validationResult = await handlers.get('ui_component_validate')?.({ name: 'button' })
    const validation = JSON.parse(validationResult?.content[0].text ?? '{}')

    expect(normalizeLineEndings(astro)).toBe(normalizeLineEndings(expectedAstro))
    expect(normalizeLineEndings(scss)).toBe(normalizeLineEndings(expectedScss))
    expect(validation.valid).toBe(true)
  }, 15_000)
})
