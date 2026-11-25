import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Accounts } from './accounts'

let root: string
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'mll-acc-')) })
afterEach(() => rmSync(root, { recursive: true, force: true }))

const C = '#6b8f71'

describe('Accounts', () => {
  it('creates accounts with their own folders and remembers the last one', () => {
    const a = new Accounts(root)
    const x = a.create('علی', C)
    const y = a.create('مریم', '#5f84a8')
    expect(a.list().map((i) => i.name)).toEqual(['علی', 'مریم'])
    expect(a.dir(x.id)).not.toBe(a.dir(y.id))
    expect(a.last()).toBe(y.id)
    expect(new Accounts(root).list()).toHaveLength(2) // persisted
  })

  it('rejects bad names, bad colors and duplicates (ignoring case)', () => {
    const a = new Accounts(root)
    a.create('Ali', C)
    for (const [n, c] of [['', C], ['  ', C], ['x'.repeat(31), C], ['a\u0007b', C], ['ok', 'red'], ['ali', C], [' ALI ', C]]) {
      expect(() => a.create(n, c), `${n}|${c}`).toThrow('BAD_NAME')
    }
    expect(() => a.create(42, C)).toThrow('BAD_NAME')
    expect(a.create('a\nb', C).name).toBe('a b') // whitespace is folded, not rejected
  })

  it('does not accept ids that are not accounts (path traversal)', () => {
    const a = new Accounts(root)
    a.create('Ali', C)
    for (const id of ['../..', '..\\..\\x', '', '123e4567-e89b-12d3-a456-426614174000']) {
      expect(() => a.dir(id)).toThrow('NO_ACCOUNT')
    }
  })

  it('moves old single-user files into the first account without losing any', () => {
    for (const f of ['vault.json', 'journal.db', 'journal.db-wal', 'settings.json']) writeFileSync(join(root, f), f)
    const a = new Accounts(root)
    expect(a.hasLegacy()).toBe(true)
    const info = a.adoptLegacy('من', C)
    const dir = a.dir(info.id)
    expect(readFileSync(join(dir, 'journal.db'), 'utf8')).toBe('journal.db')
    expect(readFileSync(join(dir, 'vault.json'), 'utf8')).toBe('vault.json')
    expect(readdirSync(root).sort()).toEqual(['accounts', 'accounts.json'])
    expect(a.hasLegacy()).toBe(false)
  })

  it('refuses to adopt when there is nothing to adopt', () => {
    expect(() => new Accounts(root).adoptLegacy('من', C)).toThrow('NO_ACCOUNT')
  })

  it('deletes only that account', () => {
    const a = new Accounts(root)
    const x = a.create('Ali', C)
    const y = a.create('Sara', C)
    const dirX = a.dir(x.id)
    writeFileSync(join(dirX, 'journal.db'), 'secret')
    a.remove(x.id)
    expect(existsSync(dirX)).toBe(false)
    expect(a.list().map((i) => i.id)).toEqual([y.id])
  })

  it('keeps a corrupt list aside instead of overwriting it', () => {
    writeFileSync(join(root, 'accounts.json'), '{not json')
    const a = new Accounts(root)
    expect(a.list()).toEqual([])
    expect(readdirSync(root).some((f) => f.startsWith('accounts.json.corrupt-'))).toBe(true)
  })
})
