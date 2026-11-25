import { describe, expect, it } from 'vitest'
import type { Entry } from '../../shared/types'
import { moodSeries, onThisDay, streak, wordCount } from './stats'

const e = (entryDate: string, mood: number | null = null, body = ''): Entry => ({
  id: entryDate + mood, title: '', body, format: 'rich', entryDate, createdAt: 0, updatedAt: 0,
  mood, deletedAt: null, tags: []
})

describe('stats', () => {
  it('counts words ignoring html tags', () => {
    expect(wordCount(e('2026-01-01', null, '<p>سلام <b>دنیا</b></p>'))).toBe(2)
  })
  it('streak counts back from today or yesterday, and breaks on a gap', () => {
    const es = [e('2026-03-10'), e('2026-03-09'), e('2026-03-08'), e('2026-03-05')]
    expect(streak(es, '2026-03-10')).toBe(3)
    expect(streak(es, '2026-03-11')).toBe(3)
    expect(streak(es, '2026-03-12')).toBe(0)
  })
  it('averages mood per day and sorts by date', () => {
    const s = moodSeries([e('2026-01-02', 4), e('2026-01-01', 2), e('2026-01-01', 6), e('2026-01-03')])
    expect(s).toEqual([{ date: '2026-01-01', mood: 4 }, { date: '2026-01-02', mood: 4 }])
  })
  it('finds same month/day in earlier years only', () => {
    const r = onThisDay([e('2025-03-10'), e('2026-03-10'), e('2025-03-11')], '2026-03-10')
    expect(r.map((x) => x.entryDate)).toEqual(['2025-03-10'])
  })
})
