import { SUPPORTED_MEDIA } from '../constants.ts'
import type { Media } from '../types.ts'

export function mediaQuery(media: Media): string | null {
  if (media === 'desktop') {
    return null
  }

  return media === 'tablet' ? '@media #{media("<", d)}' : '@media #{media("<", m)}'
}

export function parseMedia(value: string): Media {
  const normalized = value === 'phone' ? 'mobile' : value

  if (!SUPPORTED_MEDIA.includes(normalized as Media)) {
    throw new Error(`Unsupported media: ${value}`)
  }

  return normalized as Media
}
