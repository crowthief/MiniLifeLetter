import { describe, expect, it } from 'vitest'
import { hourAt, ringOf } from './clockMath'

describe('clock face', () => {
  it('puts 12 on top of the outer ring and 0 on top of the inner ring', () => {
    expect(ringOf(12)).toEqual({ pos: 0, inner: false })
    expect(ringOf(0)).toEqual({ pos: 0, inner: true })
  })

  it('every hour 0..23 maps to its own spot and back', () => {
    const spots = new Set<string>()
    for (let h = 0; h < 24; h++) {
      const { pos, inner } = ringOf(h)
      expect(hourAt(pos, inner)).toBe(h)
      spots.add(`${pos}/${inner}`)
    }
    expect(spots.size).toBe(24) // no two hours share a spot
  })

  it('reads the usual places', () => {
    expect(hourAt(3, false)).toBe(3) // 3 o'clock, outer
    expect(hourAt(6, true)).toBe(18) // bottom, inner
    expect(hourAt(11, true)).toBe(23)
  })
})
