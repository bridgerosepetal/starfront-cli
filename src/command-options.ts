import { parseMedia } from './utils/media.ts'

export type ParsedCommandOptions = {
  positional: string[]
  options: Record<string, unknown>
}

export function parseCommandOptions(tokens: string[]): ParsedCommandOptions {
  const positional: string[] = []
  const options: Record<string, unknown> = {}

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }

    const key = token.slice(2)

    if (key === 'no-destructure') {
      options.destructure = false
      continue
    }

    if (key === 'required') {
      options.required = true
      continue
    }

    const optionKey = key === 'prop-name' ? 'propName' : key === 'is-slot' ? 'isSlot' : key === 'slot-name' ? 'slotName' : key

    const value = tokens[index + 1]

    if (value === undefined || value.startsWith('--')) {
      options[optionKey] = true
      continue
    }

    index += 1

    if (optionKey === 'attr' || optionKey === 'prop') {
      options[optionKey] = [...((options[optionKey] as string[] | undefined) ?? []), value]
    } else if (optionKey === 'media') {
      options[optionKey] = parseMedia(value)
    } else {
      options[optionKey] = value
    }
  }

  return { positional, options }
}
