import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import {
  KdfParams, Wrapped, deriveKek, newKdfParams, newMasterKey,
  newRecoveryPhrase, recoveryKek, unwrap, wrap
} from './crypto'

/** On-disk key file. Holds no secrets in plaintext: the master key is wrapped twice. */
export interface VaultFile {
  version: 1
  kdf: KdfParams
  byPassword: Wrapped
  byRecovery: Wrapped
}

export const MIN_PASSWORD_LENGTH = 8

export function vaultExists(path: string): boolean {
  return existsSync(path)
}

function save(path: string, v: VaultFile): void {
  const tmp = path + '.tmp'
  writeFileSync(tmp, JSON.stringify(v), { mode: 0o600 })
  renameSync(tmp, path)
}

export async function createVault(
  path: string,
  password: string,
  kdfOverrides?: Partial<{ iterations: number; memoryKiB: number; parallelism: number }>
): Promise<{ master: Buffer; recoveryPhrase: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_SHORT')
  if (existsSync(path)) throw new Error('VAULT_EXISTS')
  const master = newMasterKey()
  const kdf = newKdfParams(kdfOverrides)
  const recoveryPhrase = newRecoveryPhrase()
  const kek = await deriveKek(password, kdf)
  save(path, {
    version: 1,
    kdf,
    byPassword: wrap(kek, master),
    byRecovery: wrap(recoveryKek(recoveryPhrase), master)
  })
  return { master, recoveryPhrase }
}

export function readVault(path: string): VaultFile {
  return JSON.parse(readFileSync(path, 'utf8')) as VaultFile
}

export async function unlockWithPassword(path: string, password: string): Promise<Buffer> {
  const v = readVault(path)
  const kek = await deriveKek(password, v.kdf)
  try {
    return unwrap(kek, v.byPassword)
  } catch {
    throw new Error('WRONG_PASSWORD')
  }
}

export function unlockWithRecovery(path: string, phrase: string): Buffer {
  const v = readVault(path)
  try {
    return unwrap(recoveryKek(phrase), v.byRecovery)
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_RECOVERY_PHRASE') throw e
    throw new Error('WRONG_RECOVERY_PHRASE')
  }
}

/** Re-wrap the master key under a new password (used after recovery or a password change). */
export async function setPassword(path: string, master: Buffer, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_SHORT')
  const v = readVault(path)
  const kdf = newKdfParams({
    iterations: v.kdf.iterations, memoryKiB: v.kdf.memoryKiB, parallelism: v.kdf.parallelism
  })
  const kek = await deriveKek(newPassword, kdf)
  save(path, { ...v, kdf, byPassword: wrap(kek, master) })
}
