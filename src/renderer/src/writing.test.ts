import { describe, expect, it } from 'vitest'
import { dayLabel, readingMinutes, wordsOf } from './writing'

describe('writing helpers', () => {
  it('counts words across spaces, newlines and the zero-width non-joiner', () => {
    expect(wordsOf('')).toBe(0)
    expect(wordsOf('  \n ')).toBe(0)
    expect(wordsOf('سلام دنیا')).toBe(2)
    expect(wordsOf('می‌روم\nخانه')).toBe(2) // "می‌روم" has a ZWNJ and is one word
  })
  it('reading time is 0 for nothing and at least 1 minute for anything', () => {
    expect(readingMinutes(0)).toBe(0)
    expect(readingMinutes(5)).toBe(1)
    expect(readingMinutes(180)).toBe(1)
    expect(readingMinutes(900)).toBe(5)
  })
  it('labels the day in the chosen calendar', () => {
    expect(dayLabel('2026-03-21', 'jalali')).toContain('۱۴۰۵')
    expect(dayLabel('2026-03-21', 'gregorian')).toContain('۲۰۲۶')
  })
})
