import type { Entry } from '../../shared/types'

export const wordCount = (e: Entry): number => {
  const text = e.format === 'rich' ? e.body.replace(/<[^>]*>/g, ' ') : e.body
  return text.split(/\s+/).filter(Boolean).length
}

const addDays = (iso: string, n: number): string => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Consecutive days with an entry, ending today (or yesterday, so the streak survives until tonight). */
export function streak(entries: Entry[], today: string): number {
  const days = new Set(entries.map((e) => e.entryDate))
  let d = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(d)) { n++; d = addDays(d, -1) }
  return n
}

// shortcut: matches Gregorian month/day only, add a Jalali variant if wanted.
export const onThisDay = (entries: Entry[], today: string): Entry[] =>
  entries.filter((e) => e.entryDate.slice(5) === today.slice(5) && e.entryDate.slice(0, 4) < today.slice(0, 4))
