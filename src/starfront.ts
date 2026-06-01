import { runStarfrontCommand, starfrontCommandReference, starfrontCommandRegistry } from './command-vocabulary.ts'
import { createComponent, deleteComponent, listComponents } from './components/repository.ts'
import { addRootClassListItem, setRootAttribute } from './mutations/root-attributes.ts'
import { deleteRootNode } from './mutations/root-delete.ts'
import { appendRootNode, clearRoot, setRoot } from './mutations/root.ts'
import { appendSlot, wrapNodeWithSlot } from './mutations/slot.ts'
import { createProp, createPropGroup } from './props.ts'
import { readComponent } from './read.ts'
import {
  declareBlockStyle,
  declareElementStyle,
  declareModifierStyle,
  deleteBlockStyle,
  deleteElementStyle,
  deleteModifierStyle,
  ensureElementStyle,
} from './styles.ts'
import { validateComponent } from './validation.ts'

export { createComponent, deleteComponent, listComponents } from './components/repository.ts'
export {
  formatCliCommand,
  runStarfrontCommand,
  starfrontCommandReference,
  starfrontCommandRegistry,
} from './command-vocabulary.ts'
export { addRootClassListItem, setRootAttribute } from './mutations/root-attributes.ts'
export { deleteRootNode } from './mutations/root-delete.ts'
export { appendRootNode, clearRoot, setRoot } from './mutations/root.ts'
export { appendSlot, wrapNodeWithSlot } from './mutations/slot.ts'
export { createProp, createPropGroup } from './props.ts'
export { readComponent } from './read.ts'
export {
  declareBlockStyle,
  declareElementStyle,
  declareModifierStyle,
  deleteBlockStyle,
  deleteElementStyle,
  deleteModifierStyle,
  ensureElementStyle,
} from './styles.ts'
export { validateComponent } from './validation.ts'

export const starfront = {
  addRootClassListItem,
  appendRootNode,
  appendSlot,
  clearRoot,
  createComponent,
  createProp,
  createPropGroup,
  deleteRootNode,
  declareBlockStyle,
  declareElementStyle,
  declareModifierStyle,
  deleteBlockStyle,
  deleteComponent,
  deleteElementStyle,
  deleteModifierStyle,
  ensureElementStyle,
  listComponents,
  readComponent,
  runStarfrontCommand,
  setRoot,
  starfrontCommandReference,
  starfrontCommandRegistry,
  setRootAttribute,
  validateComponent,
  wrapNodeWithSlot,
}
