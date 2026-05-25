import { ensureFrontmatterLine } from './frontmatter.ts'
import { addRootClassListItem, setRootAttribute } from './mutations/root-attributes.ts'
import { setRoot } from './mutations/root.ts'

type PropCreateValidationContext = {
  componentName: string
  propName: string
  props: Array<{
    name: string
  }>
}

export function runPropCreateValidationHooks(context: PropCreateValidationContext): void {
  if (context.props.some(prop => prop.name === context.propName)) {
    throw new Error(`Prop already exists: ${context.propName}`)
  }
}

export async function runPropCreateHooks(componentName: string, propName: string, cwd?: string): Promise<void> {
  if (propName === 'tag' || propName === 'as') {
    const tagSource = propName === 'tag' ? 'tag' : 'as'
    await setRoot(componentName, { cwd, component: 'Tag' })
    await setRootAttribute(componentName, {
      cwd,
      name: '...props as Record<string, unknown>',
    })
    await ensureFrontmatterLine(componentName, `const isLink: boolean = "href" in Astro.props`, cwd)
    await ensureFrontmatterLine(
      componentName,
      `const Tag: Props["${tagSource}"] = isLink ? "a" : ${tagSource} ? ${tagSource} : "button"`,
      cwd,
    )
  }

  if (propName === 'variant') {
    await addRootClassListItem(componentName, 'variant && `button_variant-${variant}`', cwd)
  }

  if (propName === 'color') {
    await addRootClassListItem(componentName, 'color && `button_color-${color}`', cwd)
  }
}
