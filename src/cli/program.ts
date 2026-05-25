import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createComponent, deleteComponent, listComponents } from '../components/repository.ts'
import { DEFAULT_MEDIA } from '../constants.ts'
import { readComponent } from '../read.ts'
import type { ReadOptions } from '../types.ts'
import { parseMedia } from '../utils/media.ts'
import { validateComponent } from '../validation.ts'

import { dispatchUpdate } from './dispatch.ts'

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

async function packageVersion(): Promise<string> {
  try {
    const currentFile = fileURLToPath(import.meta.url)
    const packagePath = path.resolve(path.dirname(currentFile), '..', 'package.json')
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
      version?: string
    }

    return packageJson.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value]
}

function addUpdateOptions(command: Command): Command {
  return command
    .option('--required', 'Create a required prop')
    .option('--group <name>', 'Props interface group for prop creation')
    .option('--extends <type>', 'Base type for a props interface group')
    .option('--no-destructure', 'Do not destructure the created prop from Astro.props')
    .option('--node <path>', 'Parent node path, usually 1 for root')
    .option('--tag <tag>', 'HTML tag to append')
    .option('--value <value>', 'Mutation value')
    .option('--name <name>', 'BEM element name for HTML nodes')
    .option('--component <name>', 'Astro component to append')
    .option('--slot [name]', 'Append a slot')
    .option('--text <content>', 'Append text content')
    .option('--expression <content>', 'Append an Astro expression')
    .option('--sibling <pathOrName>', 'Insert before or after a sibling inside the parent node')
    .option('--bem <element>', 'Apply a BEM element class to the appended node')
    .option('--attr <key=value>', 'HTML attribute', collectOption, [])
    .option('--prop <key=value>', 'Component prop', collectOption, [])
    .option('--condition <expression>', 'Wrap node in a conditional expression')
    .option('--targets <names>', 'Comma-separated element names')
    .option('--media <media>', 'desktop, tablet, or phone', parseMedia, DEFAULT_MEDIA)
    .option('--state <state>', 'State selector for element declarations: hover, active, disabled')
    .option('--base <content>', 'Base CSS declarations')
    .option('--hover <content>', 'Hover CSS declarations')
    .option('--active <content>', 'Active CSS declarations')
    .option('--disabled <content>', 'Disabled CSS declarations')
}

export async function createProgram(): Promise<Command> {
  const program = new Command()
  program.option('-C, --cwd <path>', 'Project directory', process.cwd())
  const getCwd = () => String(program.opts().cwd ?? process.cwd())

  program
    .name('starfront')
    .description('Deterministic CLI for inspecting and editing Starfront UI components')
    .version(await packageVersion())

  const ui = program.command('ui').description('Inspect and edit UI artifacts')

  ui.command('list')
    .description('List UI components')
    .action(async () => {
      printJson(await listComponents(getCwd()))
    })

  const component = ui.command('component').description('UI component commands')

  component.command('list').action(async () => {
    printJson(await listComponents(getCwd()))
  })

  component.command('create <name> [template]').action(async (name, template) => {
    printJson(await createComponent(name, template ?? 'default', getCwd()))
  })

  component
    .command('read <name> [section]')
    .option('--depth <depth>', 'Limit markup tree depth')
    .option('--element <nameOrPath>', 'Read a specific element by BEM name or path')
    .action(async (name: string, section: string | undefined, options: ReadOptions) => {
      printJson(await readComponent(name, section ?? 'all', { ...options, cwd: getCwd() }))
    })

  component.command('delete <name>').action(async name => {
    printJson(await deleteComponent(name, getCwd()))
  })

  component.command('validate <name>').action(async name => {
    printJson(await validateComponent(name, getCwd()))
  })

  addUpdateOptions(component.command('update <name> [tokens...]')).action(
    async (name: string, tokens: string[], options: Record<string, unknown>) => {
      printJson(await dispatchUpdate(name, tokens ?? [], options, getCwd()))
    },
  )

  return program
}
