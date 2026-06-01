import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cliArgsWithOptions, runStarfrontCommand } from '../command-vocabulary.ts'
import { DEFAULT_MEDIA } from '../constants.ts'
import { startStarfrontMcpServer } from '../mcp/server.ts'
import type { ReadOptions } from '../types.ts'
import { parseMedia } from '../utils/media.ts'

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

async function runAndPrint(args: string[], cwd: string): Promise<void> {
  const result = await runStarfrontCommand({ args, cwd })

  printJson(result.result)
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
    .option('--prop-name <name>', 'Prop that drives a BEM modifier class:list item')
    .option('--name <name>', 'BEM element name for HTML nodes')
    .option('--component <name>', 'Astro component to append')
    .option('--is-slot', 'Append a slot')
    .option('--slot-name <name>', 'Named slot to append; requires --is-slot')
    .option('--text <content>', 'Append text content')
    .option('--expression <content>', 'Append an Astro expression')
    .option('--sibling <pathOrName>', 'Insert before or after a sibling inside the parent node')
    .option('--bem <element>', 'Apply a BEM element class to the appended node')
    .option('--attr <key=value>', 'HTML attribute', collectOption, [])
    .option('--prop <key=value>', 'Component prop', collectOption, [])
    .option('--condition <expression>', 'Wrap node in a conditional expression')
    .option('--targets <names>', 'Comma-separated element names')
    .option('--media <media>', 'desktop, tablet, or mobile', parseMedia, DEFAULT_MEDIA)
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

  program
    .command('mcp')
    .description('Start the Starfront MCP server over stdio')
    .option('--project <path>', 'Project directory for Starfront MCP tools')
    .action(async (options: { project?: string }) => {
      await startStarfrontMcpServer({ projectRoot: options.project })
    })

  ui.command('list')
    .description('List UI components')
    .action(async () => {
      await runAndPrint(['ui', 'list'], getCwd())
    })

  const component = ui.command('component').description('UI component commands')

  component.command('list').action(async () => {
    await runAndPrint(['ui', 'component', 'list'], getCwd())
  })

  component.command('create <name> [template]').action(async (name, template) => {
    await runAndPrint(['ui', 'component', 'create', name, template ?? 'default'], getCwd())
  })

  component
    .command('read <name> [section]')
    .option('--depth <depth>', 'Limit markup tree depth')
    .option('--element <nameOrPath>', 'Read a specific element by BEM name or path')
    .action(async (name: string, section: string | undefined, options: ReadOptions) => {
      await runAndPrint(
        cliArgsWithOptions(['ui', 'component', 'read', name, section ?? 'all'], { ...options }),
        getCwd(),
      )
    })

  component.command('delete <name>').action(async name => {
    await runAndPrint(['ui', 'component', 'delete', name], getCwd())
  })

  component.command('validate <name>').action(async name => {
    await runAndPrint(['ui', 'component', 'validate', name], getCwd())
  })

  addUpdateOptions(component.command('update <name> [tokens...]')).action(
    async (name: string, tokens: string[], options: Record<string, unknown>) => {
      await runAndPrint(cliArgsWithOptions(['ui', 'component', 'update', name, ...(tokens ?? [])], options), getCwd())
    },
  )

  return program
}
