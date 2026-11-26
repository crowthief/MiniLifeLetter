import { describe, expect, it } from 'vitest'
import { freshRange } from './freshText'

describe('freshRange', () => {
  it('animates one typed character', () => {
    expect(freshRange(1, 10, 10, 1, true)).toEqual([10, 11])
  })
  it('does not animate deletes, replacements, blocks or multi-step edits', () => {
    expect(freshRange(1, 10, 11, 0, true)).toBeNull() // delete
    expect(freshRange(1, 10, 12, 1, true)).toBeNull() // replaces a selection
    expect(freshRange(1, 10, 10, 2, false)).toBeNull() // Enter / block insert
    expect(freshRange(2, 10, 10, 1, true)).toBeNull() // input rule, undo group
  })
  it('does not animate a long paste', () => {
    expect(freshRange(1, 0, 0, 40, true)).toEqual([0, 40])
    expect(freshRange(1, 0, 0, 41, true)).toBeNull()
  })
})
