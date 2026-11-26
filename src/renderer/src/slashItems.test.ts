import { describe, expect, it } from 'vitest'
import { SLASH_ITEMS, filterSlash, slashQuery } from './slashItems'

describe('slash menu', () => {
  it('opens only after a slash at the start of a word', () => {
    expect(slashQuery('/')).toBe('')
    expect(slashQuery('/تی')).toBe('تی')
    expect(slashQuery('سلام /')).toBe('')
    expect(slashQuery('سلام /لی')).toBe('لی')
  })
  it('stays closed for ordinary text and slashes inside words', () => {
    expect(slashQuery('سلام')).toBeNull()
    expect(slashQuery('a/b')).toBeNull()
    expect(slashQuery('http://x')).toBeNull()
    expect(slashQuery('/ تیتر')).toBeNull() // a space ends the command
  })
  it('lists everything for an empty query and filters by title or keyword', () => {
    expect(filterSlash('')).toHaveLength(SLASH_ITEMS.length)
    expect(filterSlash('تیتر').map((i) => i.id)).toEqual(['h1', 'h2'])
    expect(filterSlash('list').map((i) => i.id)).toContain('bullet')
    expect(filterSlash('zzzz')).toEqual([])
  })
})
