import { describe, expect, it } from 'vitest'
import type { Entry } from '../../shared/types'
import { onThisDay, streak, wordCount } from './stats'

const e = (entryDate: string, body = ''): Entry => ({
  id: entryDate + body, title: '', body, format: 'rich', entryDate, createdAt: 0, updatedAt: 0,
  deletedAt: null, tags: []
})

describe('stats', () => {
  it('counts words ignoring html tags', () => {
    expect(wordCount(e('2026-01-01', '<p>سلام <b>دنیا</b></p>'))).toBe(2)
  })
  it('streak counts back from today or yesterday, and breaks on a gap', () => {
    const es = [e('2026-03-10'), e('2026-03-09'), e('2026-03-08'), e('2026-03-05')]
    expect(streak(es, '2026-03-10')).toBe(3)
    expect(streak(es, '2026-03-11')).toBe(3)
    expect(streak(es, '2026-03-12')).toBe(0)
  })
  it('finds same month/day in earlier years only', () => {
    const r = onThisDay([e('2025-03-10'), e('2026-03-10'), e('2025-03-11')], '2026-03-10')
    expect(r.map((x) => x.entryDate)).toEqual(['2025-03-10'])
  })
})
