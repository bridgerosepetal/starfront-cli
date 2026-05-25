import type { Command } from 'commander'

import type { SUPPORTED_MEDIA } from './constants.ts'

export type Media = (typeof SUPPORTED_MEDIA)[number]

export type ComponentFiles = {
  markup: string
  style: string
  index: string
}

export type ComponentInfo = {
  name: string
  pascalName: string
  dir: string
  files: ComponentFiles
}

export type MarkupNode =
  | ElementMarkupNode
  | ComponentMarkupNode
  | SlotMarkupNode
  | TextMarkupNode
  | ExpressionMarkupNode

export type ElementMarkupNode = {
  kind: 'element'
  path?: string
  tag: string
  name?: string
  attributes: Record<string, string | boolean>
  style?: {
    mode: 'bem-block' | 'bem-element'
  }
  children: MarkupNode[]
}

export type ComponentMarkupNode = {
  kind: 'component'
  path?: string
  component: string
  props: Record<string, string | boolean>
  children: MarkupNode[]
}

export type SlotMarkupNode = {
  kind: 'slot'
  path?: string
  name: string
  children: MarkupNode[]
}

export type TextMarkupNode = {
  kind: 'text'
  path?: string
  value: string
}

export type ExpressionMarkupNode = {
  kind: 'expression'
  path?: string
  expression: string
  raw?: string
  children: MarkupNode[]
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type ReadOptions = {
  cwd?: string
  depth?: string | number
  element?: string
}

export type AppendOptions = {
  cwd?: string
  node?: string
  tag?: string
  name?: string
  component?: string
  slot?: string | boolean
  text?: string
  expression?: string
  attr?: string[]
  prop?: string[]
  condition?: string
  sibling?: string
  bem?: string
}

export type StyleDeclareOptions = {
  cwd?: string
  targets?: string
  media?: Media
  base?: string
  state?: 'hover' | 'active' | 'disabled'
  hover?: string
  active?: string
  disabled?: string
}

export type PropCreateOptions = {
  cwd?: string
  optional?: boolean
  group?: string
  extends?: string
  destructure?: boolean
}

export type RootSetOptions = {
  cwd?: string
  tag?: string
  component?: string
}

export type RootAttributeOptions = {
  cwd?: string
  name?: string
  value?: string
}

export type SlotOptions = {
  cwd?: string
  node?: string
  name?: string
}

export type CommandWithCwd = Command & {
  optsWithGlobals(): {
    cwd?: string
  }
}
