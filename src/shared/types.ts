export type EntryFormat = 'rich' | 'markdown'

export interface Entry {
  id: string
  title: string
  body: string
  format: EntryFormat
  entryDate: string // YYYY-MM-DD (Gregorian)
  createdAt: number
  updatedAt: number
  mood: number | null // 1..10
  deletedAt: number | null
  tags: string[]
}

export interface EntryInput {
  id?: string
  title: string
  body: string
  format: EntryFormat
  entryDate: string
  mood: number | null
  tags: string[]
}

export type AuthError =
  | 'PASSWORD_TOO_SHORT'
  | 'WRONG_PASSWORD'
  | 'WRONG_RECOVERY_PHRASE'
  | 'INVALID_RECOVERY_PHRASE'
  | 'VAULT_EXISTS'
  | 'LOCKED'
  | 'BAD_IMAGE'
  | 'BAD_BACKUP'
  | 'UNKNOWN'

export type Result<T> = { ok: true; value: T } | { ok: false; error: AuthError }

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  font: 'vazirmatn' | 'sahel' | 'system'
  fontSize: number // px, 14..24
  idleMinutes: number // 1..120
  reminder: string // 'HH:MM' or '' for off
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system', font: 'vazirmatn', fontSize: 17, idleMinutes: 5, reminder: ''
}

export interface Api {
  /** Native save dialog + encrypted backup file. `true` = saved, `false` = user cancelled. */
  backup(): Promise<Result<boolean>>
  /** Native open dialog. Replaces current data (old files are kept) and locks the app. */
  restore(): Promise<Result<boolean>>
  /** Native save dialog + PDF of the given HTML. */
  exportPdf(html: string): Promise<Result<boolean>>
  getSettings(): Promise<Settings>
  setSettings(s: Settings): Promise<Settings>
  status(): Promise<{ hasVault: boolean; unlocked: boolean }>
  createVault(password: string): Promise<Result<{ recoveryPhrase: string }>>
  unlock(password: string): Promise<Result<null>>
  unlockWithRecovery(phrase: string, newPassword: string): Promise<Result<null>>
  lock(): Promise<void>
  listEntries(): Promise<Result<Entry[]>>
  saveEntry(input: EntryInput): Promise<Result<Entry>>
  trashEntry(id: string): Promise<Result<null>>
  listTrash(): Promise<Result<Entry[]>>
  restoreEntry(id: string): Promise<Result<null>>
  deleteForever(id: string): Promise<Result<null>>
  /** Stores an image encrypted in the DB and returns its `mll://a/<id>` URL. */
  addImage(entryId: string, mime: string, data: Uint8Array): Promise<Result<string>>
  onLocked(cb: () => void): () => void
}
