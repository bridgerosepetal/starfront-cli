import type { ComponentInfo } from '../types.ts'

export function renderDefaultAstro(info: ComponentInfo): string {
  return `---
import type { HTMLAttributes } from "astro/types"

type Props = HTMLAttributes<"div"> & {
  class?: string
}

const { class: className, ...props } = Astro.props as Props

export { ${info.pascalName} }
---

<div class:list={["${info.name}", className]} {...props}>
</div>

<style lang="scss">
  @use "./${info.name}.scss" as *;
</style>
`
}

export function renderMinimalAstro(info: ComponentInfo): string {
  return `---
import type { HTMLAttributes } from "astro/types"

type Props = HTMLAttributes<"div"> & {
  class?: string
}

const { class: className, ...props } = Astro.props as Props

export { ${info.pascalName} }
---

<div class:list={["${info.name}", className]} {...props}>
  <slot />
</div>

<style lang="scss">
  @use "./${info.name}.scss" as *;
</style>
`
}

export function renderDefaultScss(blockName: string): string {
  return `@use "@shared/styles/utils" as *;

.${blockName} {
  // @starfront block

  // @starfront elements

  // @starfront modifiers
}
`
}

export function renderMinimalScss(blockName: string): string {
  return `@use "@shared/styles/utils" as *;

.${blockName} {
}

@media #{media("<", d)} {
  .${blockName} {
  }
}

@media #{media("<", m)} {
  .${blockName} {
  }
}
`
}

export function renderIndex(info: ComponentInfo): string {
  return `export { default as ${info.pascalName} } from "./${info.pascalName}.astro"
`
}
