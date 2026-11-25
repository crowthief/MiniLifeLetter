import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { packBackup, unpackBackup } from './backup'
import { isFuture } from '../shared/dates'
import { Accounts } from './accounts'
import { dbKeyHex } from './crypto'
import { JournalDb } from './db'
import {
  MIN_PASSWORD_LENGTH, createVault, setPassword, unlockWithPassword, unlockWithRecovery
} from './vault'
import type { AccountInfo, AuthError, EntryInput, Result, Status } from '../shared/types'

const KNOWN: AuthError[] = [
  'PASSWORD_TOO_SHORT', 'WRONG_PASSWORD', 'WRONG_RECOVERY_PHRASE', 'INVALID_RECOVERY_PHRASE',
  'VAULT_EXISTS', 'BAD_BACKUP', 'BAD_IMAGE', 'BAD_NAME', 'NO_ACCOUNT', 'FUTURE_DATE', 'LOCKED'
]
const OK = { ok: true, value: null } as const

function fail(e: unknown): { ok: false; error: AuthError } {
  const m = e instanceof Error ? e.message : ''
  return { ok: false, error: (KNOWN as string[]).includes(m) ? (m as AuthError) : 'UNKNOWN' }
}

/** Holds the unlocked database. The master key never leaves this module. */
export class Session {
  private db: JournalDb | null = null
  private activeId: string | null = null
  readonly accounts: Accounts

  constructor(root: string, private onLock: () => void) {
    this.accounts = new Accounts(root)
  }

  // Each account has its own key file, database and settings in its own folder.
  private get dir(): string {
    if (!this.activeId) throw new Error('NO_ACCOUNT')
    return this.accounts.dir(this.activeId)
  }
  private get vaultPath(): string { return join(this.dir, 'vault.json') }
  private get dbPath(): string { return join(this.dir, 'journal.db') }
  /** Settings file of the selected account, or null on the login screen (no account chosen yet). */
  get settingsPath(): string | null {
    try {
      return this.activeId ? join(this.dir, 'settings.json') : null
    } catch {
      return null
    }
  }

  status(): Status {
    return {
      accounts: this.accounts.list(), legacy: this.accounts.hasLegacy(),
      unlocked: this.db !== null, activeId: this.activeId
    }
  }

  /** Picks the account the next login is for. Closes any open database. */
  select(id: string): Result<null> {
    try {
      this.accounts.dir(id) // throws NO_ACCOUNT for unknown or malformed ids
      this.close()
      this.activeId = id
      this.accounts.setLast(id)
      return OK
    } catch (e) {
      return fail(e)
    }
  }

  async create(name: string, color: string, password: string): Promise<Result<{ recoveryPhrase: string }>> {
    let info: AccountInfo | null = null
    try {
      if (password.length < MIN_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_SHORT')
      this.close()
      info = this.accounts.create(name, color)
      this.activeId = info.id
      const { master, recoveryPhrase } = await createVault(this.vaultPath, password)
      this.open(master)
      master.fill(0)
      return { ok: true, value: { recoveryPhrase } }
    } catch (e) {
      if (info) {
        this.close()
        this.accounts.remove(info.id)
        this.activeId = null
      }
      return fail(e)
    }
  }

  async unlock(password: string): Promise<Result<null>> {
    try {
      const master = await unlockWithPassword(this.vaultPath, password)
      this.open(master)
      master.fill(0)
      return OK
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

  private close(): void {
    this.db?.close()
    this.db = null
  }

  lock(): void {
    if (!this.db) return
    this.close()
    this.onLock()
  }

  /** Moves pre-accounts data into the first account. The password stays the same. */
  adoptLegacy(name: string, color: string): Result<AccountInfo> {
    try {
      this.close()
      const info = this.accounts.adoptLegacy(name, color)
      this.activeId = info.id
      return { ok: true, value: info }
    } catch (e) {
      return fail(e)
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<Result<null>> {
    try {
      if (!this.db) throw new Error('LOCKED')
      if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_SHORT')
      const master = await unlockWithPassword(this.vaultPath, oldPassword)
      await setPassword(this.vaultPath, master, newPassword)
      master.fill(0)
      return OK
    } catch (e) {
      return fail(e)
    }
  }

  /** Deletes the open account for good, after its password is checked again. */
  async deleteAccount(password: string): Promise<Result<null>> {
    try {
      if (!this.db || !this.activeId) throw new Error('LOCKED')
      const id = this.activeId
      ;(await unlockWithPassword(this.vaultPath, password)).fill(0)
      this.close()
      this.activeId = null
      this.accounts.remove(id)
      this.onLock()
      return OK
    } catch (e) {
      return fail(e)
    }
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
    if (isFuture(input.entryDate)) return { ok: false, error: 'FUTURE_DATE' } as const
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
