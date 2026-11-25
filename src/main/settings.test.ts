import { describe, expect, it } from 'vitest'
import { sanitize } from './settings'

describe('sanitize', () => {
  it('falls back to defaults for garbage', () => {
    expect(sanitize(null).theme).toBe('system')
    expect(sanitize({ theme: 'neon', fontSize: 'x', reminder: '25:99' })).toMatchObject({
      theme: 'system', fontSize: 17, reminder: ''
    })
  })
  it('clamps numbers and accepts valid values', () => {
    const s = sanitize({ idleMinutes: 9999, fontSize: 2, reminder: '21:30', font: 'sahel' })
    expect(s).toMatchObject({ idleMinutes: 120, fontSize: 14, reminder: '21:30', font: 'sahel' })
  })
})
