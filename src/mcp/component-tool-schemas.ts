import { z } from 'zod'

export const uiComponentUpdateOptionsSchema = z
  .object({
    required: z.boolean().optional(),
    group: z.string().optional(),
    extends: z.string().optional(),
    destructure: z.boolean().optional(),
    node: z.string().optional(),
    tag: z.string().optional(),
    value: z.string().optional(),
    defaultValue: z.string().optional(),
    propName: z.string().optional(),
    name: z.string().optional(),
    component: z.string().optional(),
    isSlot: z.boolean().optional(),
    slotName: z.string().optional(),
    text: z.string().optional(),
    expression: z.string().optional(),
    sibling: z.string().optional(),
    bem: z.string().optional(),
    attr: z.array(z.string()).optional(),
    prop: z.array(z.string()).optional(),
    condition: z.string().optional(),
    targets: z.string().optional(),
    media: z.enum(['desktop', 'tablet', 'mobile']).optional(),
    state: z.enum(['hover', 'active', 'disabled']).optional(),
    base: z.string().optional(),
    hover: z.string().optional(),
    active: z.string().optional(),
    disabled: z.string().optional(),
  })
  .optional()
  .describe('Options matching Starfront CLI flags for the selected update tokens.')
