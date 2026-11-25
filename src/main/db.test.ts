import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  entryDate: '2026-01-05', mood: 7, tags: [] as string[]
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

  it('hides trashed entries and rejects out-of-range mood', () => {
    const db = new JournalDb(path, KEY)
    const e = db.save(input)
    db.trash(e.id)
    expect(db.list()).toHaveLength(0)
    expect(() => db.save({ ...input, mood: 11 })).toThrow()
    db.close()
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
