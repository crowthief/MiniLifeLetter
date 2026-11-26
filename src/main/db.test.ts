import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JournalDb } from './db'

const KEY = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)
let dir: string
let path: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mll-db-'))
  path = join(dir, 'journal.db')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const input = {
  title: 'سلام', body: 'یک خاطره‌ی محرمانه', format: 'rich' as const,
  entryDate: '2026-01-05', tags: [] as string[]
}

describe('JournalDb', () => {
  it('saves, updates and lists entries', () => {
    const db = new JournalDb(path, KEY)
    const e = db.save(input)
    db.save({ ...input, id: e.id, title: 'ویرایش' })
    const list = db.list()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('ویرایش')
    db.close()
  })

  it('persists across reopen with the same key', () => {
    const first = new JournalDb(path, KEY)
    first.save(input)
    first.close()
    const db = new JournalDb(path, KEY)
    expect(db.list()).toHaveLength(1)
    db.close()
  })

  it('refuses to open with a wrong key', () => {
    const first = new JournalDb(path, KEY)
    first.save(input)
    first.close()
    expect(() => new JournalDb(path, OTHER)).toThrow()
  })

  it('stores no plaintext on disk', () => {
    const db = new JournalDb(path, KEY)
    db.save(input)
    db.close()
    expect(readFileSync(path).includes(Buffer.from('یک خاطره‌ی محرمانه'))).toBe(false)
  })

  it('hides trashed entries', () => {
    const db = new JournalDb(path, KEY)
    const e = db.save(input)
    db.trash(e.id)
    expect(db.list()).toHaveLength(0)
    db.close()
  })

  it('drops the old mood column, keeps every entry and leaves a copy of the old file', () => {
    // Build a database in the old layout (with a mood column) using the same key.
    const old = new Database(path)
    old.pragma(`cipher='sqlcipher'`)
    old.pragma(`key="x'${KEY}'"`)
    old.exec(`CREATE TABLE entries (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
      format TEXT NOT NULL DEFAULT 'rich', entry_date TEXT NOT NULL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, mood INTEGER CHECK (mood IS NULL OR (mood BETWEEN 1 AND 10)), deleted_at INTEGER)`)
    old.prepare(`INSERT INTO entries (id, title, body, entry_date, created_at, updated_at, mood)
      VALUES ('a', 'قدیمی', 'متن', '2025-01-01', 1, 1, 7)`).run()
    old.close()

    const db = new JournalDb(path, KEY)
    expect(db.list().map((e) => e.title)).toEqual(['قدیمی'])
    db.save({ ...input, title: 'جدید' }) // saving works without the column
    expect(db.list()).toHaveLength(2)
    db.close()
    expect(existsSync(`${path}.before-mood-removal`)).toBe(true)

    // The kept copy is the untouched old database: it still has the mood value.
    const kept = new Database(`${path}.before-mood-removal`)
    kept.pragma(`cipher='sqlcipher'`)
    kept.pragma(`key="x'${KEY}'"`)
    expect((kept.prepare('SELECT mood FROM entries').get() as { mood: number }).mood).toBe(7)
    kept.close()

    // Reopening does not copy again or fail.
    const again = new JournalDb(path, KEY)
    expect(again.list()).toHaveLength(2)
    again.close()
  })

  it('normalizes and replaces tags', () => {
    const db = new JournalDb(path, KEY)
    const e = db.save({ ...input, tags: ['#کار', ' کار ', 'سفر', ''] })
    expect(e.tags).toEqual(['سفر', 'کار'].sort())
    db.save({ ...input, id: e.id, tags: ['سفر'] })
    expect(db.list()[0].tags).toEqual(['سفر'])
    db.close()
  })

  it('restores from trash and only deletes trashed entries forever', () => {
    const db = new JournalDb(path, KEY)
    const e = db.save(input)
    db.deleteForever(e.id) // not trashed: must be a no-op
    expect(db.list()).toHaveLength(1)
    db.trash(e.id)
    expect(db.listTrash()).toHaveLength(1)
    db.restore(e.id)
    expect(db.list()).toHaveLength(1)
    db.trash(e.id)
    db.deleteForever(e.id)
    expect(db.listTrash()).toHaveLength(0)
    db.close()
  })

  it('stores images, validates them, and cascades on delete', () => {
    const db = new JournalDb(path, KEY)
    const e = db.save(input)
    const id = db.addImage(e.id, 'image/png', Buffer.from([1, 2, 3]))
    expect(db.getImage(id)?.data.equals(Buffer.from([1, 2, 3]))).toBe(true)
    expect(() => db.addImage(e.id, 'text/html', Buffer.from('x'))).toThrow('BAD_IMAGE')
    expect(() => db.addImage(e.id, 'image/png', Buffer.alloc(0))).toThrow('BAD_IMAGE')
    db.trash(e.id)
    db.deleteForever(e.id)
    expect(db.getImage(id)).toBeUndefined()
    db.close()
  })
})
