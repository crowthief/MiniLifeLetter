import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

const entry = { title: 'x', body: 'راز', format: 'rich' as const, entryDate: '2026-01-01', mood: 5, tags: [] as string[] }

describe('backup and restore', () => {
  it('restores into a fresh install and opens with the original password', async () => {
    const s1 = mk(a)
    await s1.create('password-one')
    s1.save(entry)
    const bk = s1.backup()
    expect(bk.ok).toBe(true)
    s1.lock()

    const s2 = mk(b)
    expect(s2.restoreBackup((bk as { value: Buffer }).value).ok).toBe(true)
    expect((await s2.unlock('password-one')).ok).toBe(true)
    const list = s2.list()
    expect(list.ok && list.value.map((e) => e.body)).toEqual(['راز'])
  })

  it('keeps existing files when restoring over an install', async () => {
    const s1 = mk(a)
    await s1.create('password-one')
    const bk = s1.backup()
    s1.lock()
    const s2 = mk(b)
    await s2.create('password-two')
    s2.lock()
    s2.restoreBackup((bk as { value: Buffer }).value)
    expect(readdirSync(b).some((f) => f.startsWith('journal.db.before-restore-'))).toBe(true)
    expect((await s2.unlock('password-two')).ok).toBe(false)
    expect((await s2.unlock('password-one')).ok).toBe(true)
  })

  it('refuses a bad file without touching current data', async () => {
    const s = mk(a)
    await s.create('password-one')
    s.lock()
    const r = s.restoreBackup(Buffer.from('garbage garbage garbage'))
    expect(r).toEqual({ ok: false, error: 'BAD_BACKUP' })
    expect(existsSync(join(a, 'journal.db'))).toBe(true)
    expect((await s.unlock('password-one')).ok).toBe(true)
  })

  it('refuses backup while locked', () => {
    expect(mk(a).backup()).toEqual({ ok: false, error: 'LOCKED' })
  })
})
