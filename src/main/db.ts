import { randomUUID } from 'node:crypto'
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
  mood INTEGER CHECK (mood IS NULL OR (mood BETWEEN 1 AND 10)),
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
  mood: number | null; deleted_at: number | null
}

const toEntry = (r: Row, tags: string[]): Entry => ({
  id: r.id, title: r.title, body: r.body, format: r.format, entryDate: r.entry_date,
  createdAt: r.created_at, updatedAt: r.updated_at, mood: r.mood, deletedAt: r.deleted_at, tags
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
    } catch (e) {
      this.db.close()
      throw e
    }
  }

  private tagsOf(id: string): string[] {
    return (this.db.prepare('SELECT tag FROM entry_tags WHERE entry_id = ? ORDER BY tag').all(id) as { tag: string }[])
      .map((r) => r.tag)
  }

  private query(where: string, order: string): Entry[] {
    const rows = this.db.prepare(`SELECT * FROM entries WHERE ${where} ORDER BY ${order}`).all() as Row[]
    return rows.map((r) => toEntry(r, this.tagsOf(r.id)))
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
          `INSERT INTO entries (id, title, body, format, entry_date, created_at, updated_at, mood)
           VALUES (@id, @title, @body, @format, @entryDate, @now, @now, @mood)
           ON CONFLICT(id) DO UPDATE SET title=@title, body=@body, format=@format,
             entry_date=@entryDate, mood=@mood, updated_at=@now`
        )
        .run({ id, title: input.title, body: input.body, format: input.format,
          entryDate: input.entryDate, mood: input.mood, now })
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
