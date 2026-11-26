export type EntryFormat = 'rich' | 'markdown'

export interface Entry {
  id: string
  title: string
  body: string
  format: EntryFormat
  entryDate: string // YYYY-MM-DD (Gregorian)
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  tags: string[]
}

export interface EntryInput {
  id?: string
  title: string
  body: string
  format: EntryFormat
  entryDate: string
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
  | 'BAD_NAME'
  | 'NO_ACCOUNT'
  | 'FUTURE_DATE'
  | 'UNKNOWN'

export type Result<T> = { ok: true; value: T } | { ok: false; error: AuthError }

export const ACCOUNT_COLORS = ['#6b8f71', '#c0875a', '#5f84a8', '#a8678a', '#b5594f', '#8a7fb0']

export interface AccountInfo {
  id: string
  name: string
  color: string // #rrggbb
}

export interface Status {
  accounts: AccountInfo[]
  /** True when data from before accounts existed is waiting to become the first account. */
  legacy: boolean
  unlocked: boolean
  activeId: string | null
}

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
  status(): Promise<Status>
  /** Points the app at one account (for its login). Loads that account's settings. */
  selectAccount(id: string): Promise<Result<null>>
  createAccount(name: string, color: string, password: string): Promise<Result<{ recoveryPhrase: string }>>
  /** Moves the pre-accounts data into a first account. Its password stays the same. */
  adoptLegacy(name: string, color: string): Promise<Result<AccountInfo>>
  /** Permanently deletes the open account after re-checking its password. */
  deleteAccount(password: string): Promise<Result<null>>
  changePassword(oldPassword: string, newPassword: string): Promise<Result<null>>
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
