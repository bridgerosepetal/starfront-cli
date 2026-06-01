import { starfrontCommandRegistry } from './command-registry.ts'

export { starfrontCommandReference, starfrontCommandRegistry } from './command-registry.ts'

export type StarfrontCommandRun = {
  args?: string[]
  command?: string
  cwd?: string
}

export type StarfrontCommandResult = {
  command: string
  args: string[]
  result: unknown
}

function quoteArg(arg: string): string {
  if (!/[\s"'`]/.test(arg)) {
    return arg
  }

  return JSON.stringify(arg)
}

export function formatCliCommand(args: string[]): string {
  return ['starfront', ...args].map(quoteArg).join(' ')
}

export function cliArgsWithOptions(args: string[], options: Record<string, unknown> = {}): string[] {
  const nextArgs = [...args]

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || key === 'cwd') {
      continue
    }

    const optionName =
      key === 'destructure' && value === false
        ? '--no-destructure'
        : `--${key === 'propName' ? 'prop-name' : key === 'isSlot' ? 'is-slot' : key === 'slotName' ? 'slot-name' : key}`

    if (value === false) {
      continue
    }

    if (value === true || optionName === '--no-destructure') {
      nextArgs.push(optionName)
      continue
    }

    for (const item of Array.isArray(value) ? value : [value]) {
      nextArgs.push(optionName, String(item))
    }
  }

  return nextArgs
}

function splitCommand(command: string): string[] {
  const args = command.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|\S+/g) ?? []

  return args.map(arg => {
    if (arg.startsWith('"') && arg.endsWith('"')) {
      return JSON.parse(arg)
    }

    if (arg.startsWith("'") && arg.endsWith("'")) {
      return arg.slice(1, -1)
    }

    return arg
  })
}

export function normalizeStarfrontCommandRun(run: StarfrontCommandRun): { args: string[]; cwd?: string } {
  const args = [...(run.args ?? (run.command ? splitCommand(run.command) : []))]

  if (args[0] === 'starfront' || args[0] === 'starfront-cli') {
    args.shift()
  }

  let cwd = run.cwd

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if ((arg === '-C' || arg === '--cwd') && args[index + 1]) {
      cwd = args[index + 1]
      args.splice(index, 2)
      index -= 1
    }
  }

  return { args, cwd }
}

export async function runStarfrontCommand(run: StarfrontCommandRun): Promise<StarfrontCommandResult> {
  const { args, cwd } = normalizeStarfrontCommandRun(run)
  const definition = starfrontCommandRegistry.find(command => command.match(args))

  if (!definition) {
    if (args[0] === 'component') {
      throw new Error(
        `Unsupported Starfront command: ${formatCliCommand(args)}. Use "starfront ui component ..." for component commands.`,
      )
    }

    throw new Error(`Unsupported Starfront command: ${formatCliCommand(args)}`)
  }

  return {
    command: formatCliCommand(args),
    args,
    result: await definition.execute(args, { cwd }),
  }
}
