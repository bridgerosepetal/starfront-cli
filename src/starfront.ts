import { createComponent, deleteComponent, listComponents } from './components/repository.ts'
import { addRootClassListItem, setRootAttribute } from './mutations/root-attributes.ts'
import { appendRootNode, clearRoot, setRoot } from './mutations/root.ts'
import { appendSlot, wrapNodeWithSlot } from './mutations/slot.ts'
import { createProp } from './props.ts'
import { readComponent } from './read.ts'
import { declareBlockStyle, declareElementStyle, ensureElementStyle } from './styles.ts'
import { validateComponent } from './validation.ts'

export { createComponent, deleteComponent, listComponents } from './components/repository.ts'
export { addRootClassListItem, setRootAttribute } from './mutations/root-attributes.ts'
export { appendRootNode, clearRoot, setRoot } from './mutations/root.ts'
export { appendSlot, wrapNodeWithSlot } from './mutations/slot.ts'
export { createProp } from './props.ts'
export { readComponent } from './read.ts'
export { declareBlockStyle, declareElementStyle, ensureElementStyle } from './styles.ts'
export { validateComponent } from './validation.ts'

export const starfront = {
  addRootClassListItem,
  appendRootNode,
  appendSlot,
  clearRoot,
  createComponent,
  createProp,
  declareBlockStyle,
  declareElementStyle,
  deleteComponent,
  ensureElementStyle,
  listComponents,
  readComponent,
  setRoot,
  setRootAttribute,
  validateComponent,
  wrapNodeWithSlot,
}
