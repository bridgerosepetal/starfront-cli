import { bemModifierClassListItem } from '../bem.ts'
import { canonicalizeButtonTemplate } from '../components/button-canonical.ts'
import { addRootClassListItem, setRootAttribute } from '../mutations/root-attributes.ts'
import { deleteRootNode } from '../mutations/root-delete.ts'
import { appendRootNode, clearRoot, prependRootNode, setRoot } from '../mutations/root.ts'
import { appendSlot, wrapNodeWithSlot } from '../mutations/slot.ts'
import { createProp, createPropGroup, deleteProp, updateProp } from '../props.ts'
import {
  declareBlockStyle,
  declareElementStyle,
  declareModifierStyle,
  deleteBlockStyle,
  deleteElementStyle,
  deleteModifierStyle,
  ensureElementStyle,
} from '../styles.ts'
import type {
  AppendOptions,
  ModifierStyleDeclareOptions,
  ModifierStyleDeleteOptions,
  PropUpdateOptions,
  RootAttributeOptions,
  RootDeleteOptions,
  RootSetOptions,
  SlotOptions,
  StyleDeclareOptions,
  StyleDeleteOptions,
} from '../types.ts'

export async function dispatchUpdate(
  name: string,
  tokens: string[],
  rawOptions: Record<string, unknown>,
  cwd?: string,
): Promise<unknown> {
  const result = await dispatchUpdateRaw(name, tokens, rawOptions, cwd)

  await canonicalizeButtonTemplate(name, cwd)
  return result
}

async function dispatchUpdateRaw(
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

  if (area === 'root' && first === 'delete') {
    return deleteRootNode(name, options as RootDeleteOptions)
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

  if (area === 'prop' && first === 'update') {
    if (!second) {
      throw new Error('prop update requires <propName>')
    }

    return updateProp(name, second, {
      cwd,
      type: third,
      defaultValue: fourth,
      optional: !(options.required === true),
      group: typeof options.group === 'string' ? options.group : undefined,
      destructure: options.destructure !== false,
    } as PropUpdateOptions)
  }

  if (area === 'prop' && first === 'delete') {
    if (!second) {
      throw new Error('prop delete requires <propName>')
    }

    return deleteProp(name, second, {
      cwd,
      group: typeof options.group === 'string' ? options.group : undefined,
    })
  }

  if (area === 'prop' && first === 'group' && second === 'create') {
    if (!third || typeof options.extends !== 'string') {
      throw new Error('prop group create requires <groupName> --extends <type>')
    }

    return createPropGroup(name, third, options.extends, cwd)
  }

  if (area === 'bem' && first === 'element' && second === 'style' && third === 'declare') {
    if (!fourth) {
      throw new Error('bem element style declare requires <elementName>')
    }

    return declareElementStyle(name, fourth, options as StyleDeclareOptions)
  }

  if (area === 'bem' && first === 'element' && second === 'style' && third === 'delete') {
    if (!fourth) {
      throw new Error('bem element style delete requires <elementName>')
    }

    return deleteElementStyle(name, fourth, options as StyleDeleteOptions)
  }

  if (area === 'bem' && first === 'block' && second === 'style' && third === 'declare') {
    return declareBlockStyle(name, options as StyleDeclareOptions)
  }

  if (area === 'bem' && first === 'block' && second === 'style' && third === 'delete') {
    return deleteBlockStyle(name, options as StyleDeleteOptions)
  }

  if (area === 'bem' && first === 'modifier' && second === 'classlist' && third === 'add') {
    if (!fourth) {
      throw new Error('bem modifier classlist add requires <modifierName>')
    }

    return addRootClassListItem(
      name,
      bemModifierClassListItem(name, fourth, {
        expression: typeof options.expression === 'string' ? options.expression : undefined,
        propName: typeof options.propName === 'string' ? options.propName : undefined,
        value: typeof options.value === 'string' ? options.value : undefined,
      }),
      cwd,
    )
  }

  if (area === 'bem' && first === 'modifier' && second === 'style' && third === 'declare') {
    if (!fourth) {
      throw new Error('bem modifier style declare requires <modifierName>')
    }

    return declareModifierStyle(name, fourth, options as ModifierStyleDeclareOptions)
  }

  if (area === 'bem' && first === 'modifier' && second === 'style' && third === 'delete') {
    if (!fourth) {
      throw new Error('bem modifier style delete requires <modifierName>')
    }

    return deleteModifierStyle(name, fourth, options as ModifierStyleDeleteOptions)
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

    if (third === 'delete') {
      return deleteElementStyle(name, fourth, options as StyleDeleteOptions)
    }

    if (third === 'update' && fourth === 'declare') {
      return declareElementStyle(name, rest[0], options as StyleDeclareOptions)
    }
  }

  if (area === 'style' && first === 'bem' && second === 'block' && third === 'declare') {
    return declareBlockStyle(name, options as StyleDeclareOptions)
  }

  if (area === 'style' && first === 'bem' && second === 'block' && third === 'delete') {
    return deleteBlockStyle(name, options as StyleDeleteOptions)
  }

  if (area === 'style' && first === 'bem' && second === 'modifier' && third === 'declare') {
    if (!fourth) {
      throw new Error('style bem modifier declare requires <modifierName>')
    }

    return declareModifierStyle(name, fourth, options as ModifierStyleDeclareOptions)
  }

  if (area === 'style' && first === 'bem' && second === 'modifier' && third === 'delete') {
    if (!fourth) {
      throw new Error('style bem modifier delete requires <modifierName>')
    }

    return deleteModifierStyle(name, fourth, options as ModifierStyleDeleteOptions)
  }

  throw new Error(`Unsupported update command: ${tokens.join(' ')}`)
}
