import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AccountInfo } from '../shared/types'

// Files that make up one account. Installs from before accounts keep them directly in the data root.
const ACCOUNT_FILES = ['vault.json', 'journal.db', 'journal.db-wal', 'journal.db-shm', 'settings.json']
const HEX = /^#[0-9a-fA-F]{6}$/
const ID = /^[0-9a-f-]{36}$/
const norm = (s: string): string => s.normalize('NFKC').toLowerCase()

/** Validates an untrusted name and color. Throws BAD_NAME. */
export function cleanAccount(name: unknown, color: unknown): { name: string; color: string } {
  const n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : ''
  if (!n || n.length > 30 || /[\u0000-\u001f]/.test(n) || typeof color !== 'string' || !HEX.test(color)) {
    throw new Error('BAD_NAME')
  }
  return { name: n, color }
}

const valid = (a: unknown): a is AccountInfo => {
  const x = a as AccountInfo
  return !!x && ID.test(String(x.id)) && typeof x.name === 'string' && HEX.test(String(x.color))
}

interface Shape { accounts: AccountInfo[]; last: string | null }

/** The list of accounts. Each account lives in its own folder with its own key file, database and settings. */
export class Accounts {
  private file: string

  constructor(private root: string) {
    this.file = join(root, 'accounts.json')
  }

  private read(): Shape {
    try {
      const j = JSON.parse(readFileSync(this.file, 'utf8'))
      const accounts = (Array.isArray(j.accounts) ? j.accounts : []).filter(valid)
      return { accounts, last: typeof j.last === 'string' ? j.last : null }
    } catch (e) {
      // Keep an unreadable list aside instead of overwriting it with an empty one.
      if (e instanceof SyntaxError) renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
      return { accounts: [], last: null }
    }
  }

  private write(s: Shape): void {
    mkdirSync(this.root, { recursive: true })
    writeFileSync(this.file + '.tmp', JSON.stringify(s))
    renameSync(this.file + '.tmp', this.file)
  }

  list(): AccountInfo[] {
    return this.read().accounts
  }

  last(): string | null {
    const s = this.read()
    return s.accounts.some((a) => a.id === s.last) ? s.last : null
  }

  setLast(id: string): void {
    const s = this.read()
    if (s.accounts.some((a) => a.id === id)) this.write({ ...s, last: id })
  }

  /** True when the pre-accounts key file still sits in the data root. */
  hasLegacy(): boolean {
    return existsSync(join(this.root, 'vault.json'))
  }

  /** Folder of an existing account. The id comes from the renderer, so it is checked first. */
  dir(id: string): string {
    if (!ID.test(id) || !this.read().accounts.some((a) => a.id === id)) throw new Error('NO_ACCOUNT')
    return join(this.root, 'accounts', id)
  }

  private add(name: unknown, color: unknown): AccountInfo {
    const c = cleanAccount(name, color)
    const s = this.read()
    if (s.accounts.some((a) => norm(a.name) === norm(c.name))) throw new Error('BAD_NAME')
    const info = { id: randomUUID(), ...c }
    mkdirSync(join(this.root, 'accounts', info.id), { recursive: true })
    this.write({ accounts: [...s.accounts, info], last: info.id })
    return info
  }

  create(name: unknown, color: unknown): AccountInfo {
    return this.add(name, color)
  }

  /** Moves the old single-user files into a new first account. Undoes the moves if one fails. */
  adoptLegacy(name: unknown, color: unknown): AccountInfo {
    if (!this.hasLegacy()) throw new Error('NO_ACCOUNT')
    const info = this.add(name, color)
    const to = join(this.root, 'accounts', info.id)
    const moved: string[] = []
    try {
      for (const f of ACCOUNT_FILES) {
        if (!existsSync(join(this.root, f))) continue
        renameSync(join(this.root, f), join(to, f))
        moved.push(f)
      }
    } catch (e) {
      for (const f of moved) renameSync(join(to, f), join(this.root, f))
      this.remove(info.id)
      throw e
    }
    return info
  }

  /** Deletes the account folder for good. The caller must close its database first. */
  remove(id: string): void {
    const s = this.read()
    const dir = this.dir(id)
    rmSync(dir, { recursive: true, force: true })
    this.write({ accounts: s.accounts.filter((a) => a.id !== id), last: s.last === id ? null : s.last })
  }
}
