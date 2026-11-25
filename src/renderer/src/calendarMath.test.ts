import { describe, expect, it } from 'vitest'
import { monthOf, shiftMonth } from './calendarMath'

describe('calendar', () => {
  it('Farvardin 1405 starts on 2026-03-21 and has 31 days', () => {
    const m = monthOf('2026-04-01', 'jalali')
    expect(m.cells[0].iso).toBe('2026-03-21')
    expect(m.cells).toHaveLength(31)
    expect(m.cells[0].day).toBe(1)
    // 2026-03-21 is a Saturday, the first Jalali weekday
    expect(m.offset).toBe(0)
  })

  it('Gregorian February 2026 has 28 days and starts on Sunday', () => {
    const m = monthOf('2026-02-10', 'gregorian')
    expect(m.cells).toHaveLength(28)
    expect(m.cells[0].iso).toBe('2026-02-01')
    expect(m.offset).toBe(0)
  })

  it('shifts across year boundaries', () => {
    expect(monthOf(shiftMonth('2026-01-15', 'gregorian', -1), 'gregorian').cells[0].iso).toBe('2025-12-01')
    expect(monthOf(shiftMonth('2026-12-15', 'gregorian', 1), 'gregorian').cells[0].iso).toBe('2027-01-01')
    // Esfand 1404 ends 2026-03-20, so the next Jalali month is Farvardin 1405
    expect(monthOf(shiftMonth('2026-03-01', 'jalali', 1), 'jalali').cells[0].iso).toBe('2026-03-21')
  })
})
