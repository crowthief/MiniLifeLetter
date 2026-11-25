import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { argon2id } from 'hash-wasm'
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

export interface Wrapped {
  iv: string
  ct: string
  tag: string
}

export interface KdfParams {
  salt: string
  iterations: number
  memoryKiB: number
  parallelism: number
}

export const DEFAULT_KDF = { iterations: 3, memoryKiB: 65536, parallelism: 1 }

export function newKdfParams(overrides: Partial<typeof DEFAULT_KDF> = {}): KdfParams {
  return { salt: randomBytes(16).toString('hex'), ...DEFAULT_KDF, ...overrides }
}

export async function deriveKek(password: string, p: KdfParams): Promise<Buffer> {
  const out = await argon2id({
    password: password.normalize('NFKC'),
    salt: Buffer.from(p.salt, 'hex'),
    iterations: p.iterations,
    memorySize: p.memoryKiB,
    parallelism: p.parallelism,
    hashLength: 32,
    outputType: 'binary'
  })
  return Buffer.from(out)
}

export function wrap(key: Buffer, data: Buffer): Wrapped {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(data), c.final()])
  return { iv: iv.toString('hex'), ct: ct.toString('hex'), tag: c.getAuthTag().toString('hex') }
}

export function unwrap(key: Buffer, w: Wrapped): Buffer {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(w.iv, 'hex'))
  d.setAuthTag(Buffer.from(w.tag, 'hex'))
  return Buffer.concat([d.update(Buffer.from(w.ct, 'hex')), d.final()])
}

export function newMasterKey(): Buffer {
  return randomBytes(32)
}

export function newRecoveryPhrase(): string {
  return entropyToMnemonic(randomBytes(32), wordlist)
}

export function recoveryKek(phrase: string): Buffer {
  const normalized = phrase.trim().toLowerCase().split(/\s+/).join(' ')
  if (!validateMnemonic(normalized, wordlist)) throw new Error('INVALID_RECOVERY_PHRASE')
  const entropy = mnemonicToEntropy(normalized, wordlist)
  return createHash('sha256').update('minilifeletter-recovery-v1').update(entropy).digest()
}

/** Hex key passed to SQLCipher, derived from the master key with domain separation. */
export function dbKeyHex(master: Buffer): string {
  return createHash('sha256').update('minilifeletter-db-v1').update(master).digest('hex')
}
