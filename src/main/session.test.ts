import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isFuture } from '../shared/dates'
import { Session } from './session'

let a: string
let b: string
let open: Session[] = []
const mk = (dir: string): Session => { const s = new Session(dir, () => {}); open.push(s); return s }
beforeEach(() => {
  a = mkdtempSync(join(tmpdir(), 'mll-a-'))
  b = mkdtempSync(join(tmpdir(), 'mll-b-'))
})
afterEach(() => {
  open.forEach((s) => s.lock())
  open = []
  rmSync(a, { recursive: true, force: true })
  rmSync(b, { recursive: true, force: true })
})

const entry = { title: 'x', body: 'راز', format: 'rich' as const, entryDate: '2026-01-01', tags: [] as string[] }

describe('backup and restore', () => {
  it('restores into a fresh install and opens with the original password', async () => {
    const s1 = mk(a)
    await s1.create('acc', '#6b8f71', 'password-one')
    s1.save(entry)
    const bk = s1.backup()
    expect(bk.ok).toBe(true)
    s1.lock()

    const s2 = mk(b)
    await s2.create('acc', '#6b8f71', 'temp-password')
    expect(s2.restoreBackup((bk as { value: Buffer }).value).ok).toBe(true)
    expect((await s2.unlock('password-one')).ok).toBe(true)
    const list = s2.list()
    expect(list.ok && list.value.map((e) => e.body)).toEqual(['راز'])
  })

  it('keeps existing files when restoring over an install', async () => {
    const s1 = mk(a)
    await s1.create('acc', '#6b8f71', 'password-one')
    const bk = s1.backup()
    s1.lock()
    const s2 = mk(b)
    await s2.create('acc', '#6b8f71', 'password-two')
    s2.lock()
    s2.restoreBackup((bk as { value: Buffer }).value)
    expect(readdirSync(s2.accounts.dir(s2.status().activeId!)).some((f) => f.startsWith('journal.db.before-restore-'))).toBe(true)
    expect((await s2.unlock('password-two')).ok).toBe(false)
    expect((await s2.unlock('password-one')).ok).toBe(true)
  })

  it('refuses a bad file without touching current data', async () => {
    const s = mk(a)
    await s.create('acc', '#6b8f71', 'password-one')
    s.lock()
    const r = s.restoreBackup(Buffer.from('garbage garbage garbage'))
    expect(r).toEqual({ ok: false, error: 'BAD_BACKUP' })
    expect(existsSync(join(s.accounts.dir(s.status().activeId!), 'journal.db'))).toBe(true)
    expect((await s.unlock('password-one')).ok).toBe(true)
  })

  it('refuses backup while locked', () => {
    expect(mk(a).backup()).toEqual({ ok: false, error: 'LOCKED' })
  })
})

const C = '#6b8f71'
const ok = (r: { ok: boolean }): boolean => r.ok

describe('accounts', () => {
  it('keeps accounts separate: own password, own entries', async () => {
    const s = mk(a)
    await s.create('Ali', C, 'ali-password')
    s.save(entry)
    s.lock()
    await s.create('Sara', C, 'sara-password')
    const sara = s.list()
    expect(sara.ok && sara.value).toEqual([])
    s.lock()
    const [ali, sr] = s.status().accounts
    s.select(ali.id)
    expect(ok(await s.unlock('sara-password'))).toBe(false)
    expect(ok(await s.unlock('ali-password'))).toBe(true)
    const l = s.list()
    expect(l.ok && l.value).toHaveLength(1)
    s.select(sr.id)
    expect(s.list()).toEqual({ ok: false, error: 'LOCKED' }) // selecting another account closes the first
  })

  it('moves a pre-accounts install into the first account and keeps its password and entries', async () => {
    const old = mk(b)
    await old.create('tmp', C, 'old-password')
    old.save(entry)
    old.lock()
    const dir = old.accounts.dir(old.status().activeId!)
    // Rebuild the old single-user layout: files directly in the data root.
    for (const f of ['vault.json', 'journal.db']) writeFileSync(join(a, f), readFileSync(join(dir, f)))
    const s = mk(a)
    expect(s.status().legacy).toBe(true)
    const r = s.adoptLegacy('من', C)
    expect(r.ok).toBe(true)
    expect(s.status().legacy).toBe(false)
    expect(ok(await s.unlock('old-password'))).toBe(true)
    const l = s.list()
    expect(l.ok && l.value.map((e) => e.body)).toEqual(['راز'])
  })

  it('changes the password only when the old one is right', async () => {
    const s = mk(a)
    await s.create('Ali', C, 'password-one')
    expect(await s.changePassword('wrong-wrong', 'password-two')).toEqual({ ok: false, error: 'WRONG_PASSWORD' })
    expect(ok(await s.changePassword('password-one', 'password-two'))).toBe(true)
    s.lock()
    expect(ok(await s.unlock('password-one'))).toBe(false)
    expect(ok(await s.unlock('password-two'))).toBe(true)
  })

  it('deletes an account only with its password, and leaves the others', async () => {
    const s = mk(a)
    await s.create('Ali', C, 'ali-password')
    s.lock()
    await s.create('Sara', C, 'sara-password')
    expect(await s.deleteAccount('nope-nope-nope')).toEqual({ ok: false, error: 'WRONG_PASSWORD' })
    expect(s.status().accounts).toHaveLength(2)
    expect(ok(await s.deleteAccount('sara-password'))).toBe(true)
    expect(s.status().accounts.map((x) => x.name)).toEqual(['Ali'])
    expect(s.status().unlocked).toBe(false)
  })

  it('rolls back the account when creation fails (short password)', async () => {
    const s = mk(a)
    expect(await s.create('Ali', C, 'short')).toEqual({ ok: false, error: 'PASSWORD_TOO_SHORT' })
    expect(s.status().accounts).toEqual([])
  })

  it('does not save entries dated in the future', async () => {
    const s = mk(a)
    await s.create('Ali', C, 'password-one')
    expect(s.save({ ...entry, entryDate: '2999-01-01' })).toEqual({ ok: false, error: 'FUTURE_DATE' })
    expect(s.save({ ...entry, entryDate: 'not-a-date' })).toEqual({ ok: false, error: 'FUTURE_DATE' })
    expect(s.save({ ...entry, entryDate: '2020-01-01' }).ok).toBe(true)
  })

  it('isFuture compares plain dates', () => {
    expect(isFuture('2026-05-02', '2026-05-01')).toBe(true)
    expect(isFuture('2026-05-01', '2026-05-01')).toBe(false)
    expect(isFuture('2025-12-31', '2026-01-01')).toBe(false)
  })
})
