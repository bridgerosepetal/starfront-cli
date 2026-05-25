import type { ComponentInfo } from '../types.ts'

export function renderButtonAstro(info: ComponentInfo): string {
  return `---
import type { HTMLAttributes } from "astro/types"
import Icon from "@shared/ui/icon/Icon.astro"
import type { IconKey } from "@shared/ui/icon/Icon.astro"

interface ButtonProps extends HTMLAttributes<'button'> {
  tag?: "button" | "div" | "span"
  href?: never
}

interface AnchorProps extends HTMLAttributes<'a'> {
  tag?: "a"
  href: string
}

type Props = (ButtonProps | AnchorProps) & {
  variant?: "contained" | "text" | "certificates"
  color?: "green" | "white" | "opacity"
  class?: string
  iconStart?: IconKey
  iconEnd?: IconKey
  text?: string
}

const {
  tag,
  variant = "contained",
  color = "green",
  class: className,
  iconStart,
  iconEnd,
  text,
  ...props
} = Astro.props as Props

const isLink: boolean = "href" in Astro.props
const Tag: Props["tag"] = isLink ? "a" : tag ? tag : "button"
---

<Tag
  { ...props as Record<string, unknown> }
  class:list={[
    "${info.name}",
    variant && \`${info.name}_variant-\${variant}\`,
    color && \`${info.name}_color-\${color}\`,
    className,
  ]}
>
  <slot>
    {
      iconStart && (
        <span class="${info.name}__icon">
          <Icon
            name={iconStart}
          />
        </span>
      )
    }
    <span class="${info.name}__text">{text}</span>
    {
      iconEnd && (
        <span class="${info.name}__icon">
          <Icon
            name={iconEnd}
          />
        </span>
      )
    }
  </slot>
</Tag>

<style lang="scss">
  @use "./${info.name}.scss" as *;
</style>
`
}

export function renderButtonScss(blockName: string): string {
  return `@use "@shared/styles/utils" as *;

.${blockName} {
  $self: &;
  background: white;
  transition: $transition;

  @include hover() {
    background: black;

    #{$self}__text {
      color: white;
    }
  }

  &__icon {
    width: 16px;
    aspect-ratio: 1 / 1;
    height: 16px;
  }

  &__text {
    font-size: 16px;
    color: black;
  }
}

@media #{media("<", d)} {
  .${blockName} {
    &__text {
      font-size: 14px;
    }
  }
}

@media #{media("<", m)} {
  .${blockName} {
    &__text {
      font-size: 12px;
    }
  }
}
`
}
