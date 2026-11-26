import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync } from 'node:fs'
import Database from 'better-sqlite3-multiple-ciphers'
import type { Entry, EntryInput } from '../shared/types'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'rich' CHECK (format IN ('rich','markdown')),
  entry_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(entry_date);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag)
);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  data BLOB NOT NULL
);
`

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

interface Row {
  id: string; title: string; body: string; format: 'rich' | 'markdown'
  entry_date: string; created_at: number; updated_at: number
  deleted_at: number | null
}

const toEntry = (r: Row, tags: string[]): Entry => ({
  id: r.id, title: r.title, body: r.body, format: r.format, entryDate: r.entry_date,
  createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, tags
})

const cleanTags = (tags: string[]): string[] =>
  [...new Set(tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]

export class JournalDb {
  private db: Database.Database

  constructor(path: string, keyHex: string) {
    this.db = new Database(path)
    try {
      this.db.pragma(`cipher='sqlcipher'`)
      this.db.pragma(`key="x'${keyHex}'"`)
      // Fails here if the key is wrong or the file is not a valid encrypted DB.
      this.db.prepare('SELECT count(*) FROM sqlite_master').get()
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('foreign_keys = ON')
      this.db.exec(SCHEMA)
      this.dropMood(path)
    } catch (e) {
      this.db.close()
      throw e
    }
  }

  /**
   * Mood was removed from the app. Older databases still carry the column: copy the whole file once,
   * then drop it. A failure here must never stop the journal from opening: the column is nullable, so
   * leaving it in place is harmless and the next open tries again.
   */
  private dropMood(path: string): void {
    try {
      const cols = this.db.pragma('table_info(entries)') as { name: string }[]
      if (!cols.some((c) => c.name === 'mood')) return
      const copy = `${path}.before-mood-removal`
      if (!existsSync(copy)) {
        this.db.pragma('wal_checkpoint(TRUNCATE)') // fold the WAL in so the file alone is complete
        copyFileSync(path, copy)
      }
      this.db.exec('ALTER TABLE entries DROP COLUMN mood')
    } catch {
      // see above
    }
  }

  /** Rows plus their tags in two queries total. One query per entry made the list slow for big journals. */
  private query(where: string, order: string): Entry[] {
    const rows = this.db.prepare(`SELECT * FROM entries WHERE ${where} ORDER BY ${order}`).all() as Row[]
    const tags = new Map<string, string[]>()
    const all = this.db.prepare(
      `SELECT entry_id, tag FROM entry_tags WHERE entry_id IN (SELECT id FROM entries WHERE ${where}) ORDER BY tag`
    ).all() as { entry_id: string; tag: string }[]
    for (const t of all) tags.set(t.entry_id, [...(tags.get(t.entry_id) ?? []), t.tag])
    return rows.map((r) => toEntry(r, tags.get(r.id) ?? []))
  }

  list(): Entry[] {
    return this.query('deleted_at IS NULL', 'entry_date DESC, created_at DESC')
  }

  listTrash(): Entry[] {
    return this.query('deleted_at IS NOT NULL', 'deleted_at DESC')
  }

  save(input: EntryInput): Entry {
    const now = Date.now()
    const id = input.id ?? randomUUID()
    const tags = cleanTags(input.tags)
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO entries (id, title, body, format, entry_date, created_at, updated_at)
           VALUES (@id, @title, @body, @format, @entryDate, @now, @now)
           ON CONFLICT(id) DO UPDATE SET title=@title, body=@body, format=@format,
             entry_date=@entryDate, updated_at=@now`
        )
        .run({ id, title: input.title, body: input.body, format: input.format,
          entryDate: input.entryDate, now })
      this.db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(id)
      const ins = this.db.prepare('INSERT INTO entry_tags (entry_id, tag) VALUES (?, ?)')
      for (const t of tags) ins.run(id, t)
    })()
    return toEntry(this.db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Row, tags.sort())
  }

  trash(id: string): void {
    this.db.prepare('UPDATE entries SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
  }

  restore(id: string): void {
    this.db.prepare('UPDATE entries SET deleted_at = NULL WHERE id = ?').run(id)
  }

  deleteForever(id: string): void {
    this.db.prepare('DELETE FROM entries WHERE id = ? AND deleted_at IS NOT NULL').run(id)
  }

  addImage(entryId: string, mime: string, data: Buffer): string {
    if (!IMAGE_MIMES.includes(mime) || data.length === 0 || data.length > MAX_IMAGE_BYTES) {
      throw new Error('BAD_IMAGE')
    }
    const id = randomUUID()
    this.db.prepare('INSERT INTO attachments (id, entry_id, mime, data) VALUES (?, ?, ?, ?)').run(id, entryId, mime, data)
    return id
  }

  getImage(id: string): { mime: string; data: Buffer } | undefined {
    return this.db.prepare('SELECT mime, data FROM attachments WHERE id = ?').get(id) as
      { mime: string; data: Buffer } | undefined
  }

  purgeTrash(olderThanMs = 30 * 24 * 3600 * 1000): void {
    this.db.prepare('DELETE FROM entries WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(Date.now() - olderThanMs)
  }

  /** Flushes the WAL into journal.db so the file alone is a complete copy. */
  checkpoint(): void {
    this.db.pragma('wal_checkpoint(TRUNCATE)')
  }

  close(): void {
    this.db.close()
  }
}
