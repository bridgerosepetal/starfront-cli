export function normalizeUpdateOptions(options: Record<string, unknown> = {}): Record<string, unknown> {
  const { isSlot, slotName, ...normalized } = options

  if (!isSlot) {
    if (slotName) {
      throw new Error('slotName requires isSlot: true')
    }

    return normalized
  }

  return {
    ...normalized,
    isSlot: true,
    ...(typeof slotName === 'string' && slotName ? { slotName } : {}),
  }
}
