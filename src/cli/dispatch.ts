import { addRootClassListItem, setRootAttribute } from '../mutations/root-attributes.ts'
import { appendRootNode, clearRoot, prependRootNode, setRoot } from '../mutations/root.ts'
import { appendSlot, wrapNodeWithSlot } from '../mutations/slot.ts'
import { createProp, createPropGroup } from '../props.ts'
import { declareBlockStyle, declareElementStyle, ensureElementStyle } from '../styles.ts'
import type { AppendOptions, RootAttributeOptions, RootSetOptions, SlotOptions, StyleDeclareOptions } from '../types.ts'

export async function dispatchUpdate(
  name: string,
  tokens: string[],
  rawOptions: Record<string, unknown>,
  cwd?: string,
): Promise<unknown> {
  const [area, first, second, third, fourth, ...rest] = tokens
  const options: Record<string, unknown> & { cwd?: string } = {
    ...rawOptions,
    cwd,
  }

  if (area === 'root' && first === 'append') {
    if (!options.node) {
      throw new Error('root append requires --node')
    }

    return appendRootNode(name, options as AppendOptions)
  }

  if (area === 'root' && first === 'prepend') {
    if (!options.node) {
      throw new Error('root prepend requires --node')
    }

    return prependRootNode(name, options as AppendOptions)
  }

  if (area === 'root' && first === 'clear') {
    return clearRoot(name, cwd)
  }

  if (area === 'root' && first === 'set') {
    return setRoot(name, options as RootSetOptions)
  }

  if (area === 'root' && first === 'attr' && second === 'set') {
    return setRootAttribute(name, options as RootAttributeOptions)
  }

  if (area === 'root' && first === 'classlist' && second === 'add') {
    if (typeof options.value !== 'string') {
      throw new Error('root classlist add requires --value')
    }

    return addRootClassListItem(name, options.value, cwd)
  }

  if (area === 'root' && first === 'slot' && second === 'append') {
    return appendSlot(name, options as SlotOptions)
  }

  if (area === 'root' && first === 'slot' && second === 'wrap') {
    return wrapNodeWithSlot(name, options as SlotOptions)
  }

  if (area === 'prop' && first === 'create') {
    if (!second || !third) {
      throw new Error('prop create requires <propName> <type> [defaultValue]')
    }

    return createProp(name, second, third, fourth, {
      cwd,
      optional: !(options.required === true),
      group: typeof options.group === 'string' ? options.group : undefined,
      destructure: options.destructure !== false,
    })
  }

  if (area === 'prop' && first === 'group' && second === 'create') {
    if (!third || typeof options.extends !== 'string') {
      throw new Error('prop group create requires <groupName> --extends <type>')
    }

    return createPropGroup(name, third, options.extends, cwd)
  }

  if (area === 'style' && first === 'bem' && second === 'element') {
    if (third === 'create') {
      if (!fourth) {
        throw new Error('style bem element create requires <elementName>')
      }

      return ensureElementStyle(name, fourth, cwd)
    }

    if (third === 'declare') {
      return declareElementStyle(name, fourth, options as StyleDeclareOptions)
    }

    if (third === 'update' && fourth === 'declare') {
      return declareElementStyle(name, rest[0], options as StyleDeclareOptions)
    }
  }

  if (area === 'style' && first === 'bem' && second === 'block' && third === 'declare') {
    return declareBlockStyle(name, options as StyleDeclareOptions)
  }

  throw new Error(`Unsupported update command: ${tokens.join(' ')}`)
}
