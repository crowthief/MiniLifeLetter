import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { packBackup, unpackBackup } from './backup'
import { dbKeyHex } from './crypto'
import { JournalDb } from './db'
import { createVault, setPassword, unlockWithPassword, unlockWithRecovery, vaultExists } from './vault'
import type { AuthError, EntryInput, Result } from '../shared/types'

const KNOWN: AuthError[] = [
  'PASSWORD_TOO_SHORT', 'WRONG_PASSWORD', 'WRONG_RECOVERY_PHRASE',
  'INVALID_RECOVERY_PHRASE', 'VAULT_EXISTS', 'BAD_BACKUP'
]

function fail(e: unknown): { ok: false; error: AuthError } {
  const m = e instanceof Error ? e.message : ''
  return { ok: false, error: (KNOWN as string[]).includes(m) ? (m as AuthError) : 'UNKNOWN' }
}

/** Holds the unlocked database. The master key never leaves this module. */
export class Session {
  private db: JournalDb | null = null
  private vaultPath: string
  private dbPath: string

  constructor(dataDir: string, private onLock: () => void) {
    this.vaultPath = join(dataDir, 'vault.json')
    this.dbPath = join(dataDir, 'journal.db')
  }

  status() {
    return { hasVault: vaultExists(this.vaultPath), unlocked: this.db !== null }
  }

  async create(password: string): Promise<Result<{ recoveryPhrase: string }>> {
    try {
      const { master, recoveryPhrase } = await createVault(this.vaultPath, password)
      this.open(master)
      master.fill(0)
      return { ok: true, value: { recoveryPhrase } }
    } catch (e) {
      return fail(e)
    }
  }

  async unlock(password: string): Promise<Result<null>> {
    try {
      const master = await unlockWithPassword(this.vaultPath, password)
      this.open(master)
      master.fill(0)
      return { ok: true, value: null }
    } catch (e) {
      return fail(e)
    }
  }

  async recover(phrase: string, newPassword: string): Promise<Result<null>> {
    try {
      const master = unlockWithRecovery(this.vaultPath, phrase)
      await setPassword(this.vaultPath, master, newPassword)
      this.open(master)
      master.fill(0)
      return { ok: true, value: null }
    } catch (e) {
      return fail(e)
    }
  }

  private open(master: Buffer): void {
    this.db?.close()
    this.db = new JournalDb(this.dbPath, dbKeyHex(master))
    this.db.purgeTrash()
  }

  lock(): void {
    if (!this.db) return
    this.db.close()
    this.db = null
    this.onLock()
  }

  withDb<T>(fn: (db: JournalDb) => T): Result<T> {
    if (!this.db) return { ok: false, error: 'LOCKED' }
    try {
      return { ok: true, value: fn(this.db) }
    } catch (e) {
      return e instanceof Error && e.message === 'BAD_IMAGE'
        ? { ok: false, error: 'BAD_IMAGE' }
        : { ok: false, error: 'UNKNOWN' }
    }
  }

  backup(): Result<Buffer> {
    const r = this.withDb((d) => d.checkpoint())
    if (!r.ok) return r
    return { ok: true, value: packBackup(readFileSync(this.vaultPath), readFileSync(this.dbPath)) }
  }

  /** Validates first, then moves the current files aside (never deletes them) and installs the backup. */
  restoreBackup(file: Buffer): Result<null> {
    try {
      const { vault, db } = unpackBackup(file)
      this.lock()
      const stamp = `.before-restore-${Date.now()}`
      for (const f of [this.vaultPath, this.dbPath, this.dbPath + '-wal', this.dbPath + '-shm']) {
        if (existsSync(f)) renameSync(f, f + stamp)
      }
      writeFileSync(this.vaultPath, vault, { mode: 0o600 })
      writeFileSync(this.dbPath, db)
      return { ok: true, value: null }
    } catch (e) {
      return fail(e)
    }
  }

  save(input: EntryInput) {
    return this.withDb((d) => d.save(input))
  }
  list() {
    return this.withDb((d) => d.list())
  }
  trash(id: string) {
    return this.withDb((d) => (d.trash(id), null))
  }
  listTrash() {
    return this.withDb((d) => d.listTrash())
  }
  restore(id: string) {
    return this.withDb((d) => (d.restore(id), null))
  }
  deleteForever(id: string) {
    return this.withDb((d) => (d.deleteForever(id), null))
  }
  addImage(entryId: string, mime: string, data: Uint8Array): Result<string> {
    const r = this.withDb((d) => d.addImage(entryId, mime, Buffer.from(data)))
    if (!r.ok) return r
    return { ok: true, value: `mll://a/${r.value}` }
  }
  image(id: string) {
    return this.db?.getImage(id)
  }
}
