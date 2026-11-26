export type CalKind = 'jalali' | 'gregorian'

const iso = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Building an Intl formatter is slow and monthOf() asks for ~60 of them: make each one once.
const PARTS_FMT: Record<CalKind, Intl.DateTimeFormat> = {
  jalali: new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }),
  gregorian: new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

const parts = (d: Date, kind: CalKind): { y: number; m: number; d: number } => {
  const f = PARTS_FMT[kind]
  const o: Record<string, number> = {}
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return { y: o.year, m: o.month, d: o.day }
}

export const noon = (isoDate: string): Date => new Date(isoDate + 'T12:00:00')

export interface Cell { iso: string; day: number }
export interface Month { title: string; offset: number; cells: Cell[] }

/** Month containing `anchor`. `offset` = empty cells before day 1 (week starts Saturday for Jalali, Monday... Sunday for Gregorian). */
export function monthOf(anchorIso: string, kind: CalKind): Month {
  const anchor = noon(anchorIso)
  const target = parts(anchor, kind)
  const first = new Date(anchor)
  first.setDate(first.getDate() - (target.d - 1))
  const cells: Cell[] = []
  for (let d = new Date(first); parts(d, kind).m === target.m; d.setDate(d.getDate() + 1)) {
    cells.push({ iso: iso(d), day: parts(d, kind).d })
  }
  const dow = first.getDay() // 0 = Sunday
  const offset = kind === 'jalali' ? (dow + 1) % 7 : dow
  const title = new Intl.DateTimeFormat(`fa-IR-u-ca-${kind === 'jalali' ? 'persian' : 'gregory'}`, {
    year: 'numeric', month: 'long'
  }).format(anchor)
  return { title, offset, cells }
}

/** Anchor date in the previous/next month of the same calendar. */
export function shiftMonth(anchorIso: string, kind: CalKind, delta: 1 | -1): string {
  const m = monthOf(anchorIso, kind)
  const d = noon(m.cells[delta === 1 ? m.cells.length - 1 : 0].iso)
  d.setDate(d.getDate() + delta)
  return iso(d)
}
