import type { CalKind } from './calendarMath'

/** Words in plain text. Splits on whitespace and the Persian zero-width non-joiner is NOT a separator. */
export const wordsOf = (text: string): number => text.split(/\s+/).filter(Boolean).length

const WORDS_PER_MINUTE = 180 // slow-ish on purpose: Persian reads a little slower than English

/** Minutes to read, at least 1 for any non-empty text and 0 for empty. */
export const readingMinutes = (words: number): number => (words <= 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)))

export const dayLabel = (iso: string, kind: CalKind): string =>
  new Intl.DateTimeFormat(`fa-IR-u-ca-${kind === 'jalali' ? 'persian' : 'gregory'}`, { dateStyle: 'full' })
    .format(new Date(iso + 'T12:00:00'))
