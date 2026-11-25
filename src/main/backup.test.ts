import { describe, expect, it } from 'vitest'
import { packBackup, unpackBackup } from './backup'

const vault = (kdf: object): Buffer =>
  Buffer.from(JSON.stringify({ version: 1, kdf: { salt: 'ab', iterations: 3, memoryKiB: 65536, parallelism: 1, ...kdf }, byPassword: {}, byRecovery: {} }))

describe('backup format', () => {
  it('round-trips vault and db bytes', () => {
    const db = Buffer.from([1, 2, 3, 4])
    const r = unpackBackup(packBackup(vault({}), db))
    expect(r.db.equals(db)).toBe(true)
    expect(JSON.parse(r.vault.toString()).version).toBe(1)
  })

  it('rejects files that are not backups', () => {
    expect(() => unpackBackup(Buffer.from('hello world, not a backup'))).toThrow('BAD_BACKUP')
    expect(() => unpackBackup(Buffer.alloc(0))).toThrow('BAD_BACKUP')
  })

  it('rejects a truncated file and a vault that is not JSON', () => {
    const ok = packBackup(vault({}), Buffer.from([9]))
    expect(() => unpackBackup(ok.subarray(0, 20))).toThrow('BAD_BACKUP')
    expect(() => unpackBackup(packBackup(Buffer.from('nope'), Buffer.from([9])))).toThrow('BAD_BACKUP')
  })

  it('rejects absurd KDF costs from a crafted file', () => {
    expect(() => unpackBackup(packBackup(vault({ memoryKiB: 8_000_000 }), Buffer.from([9])))).toThrow('BAD_BACKUP')
    expect(() => unpackBackup(packBackup(vault({ iterations: 999 }), Buffer.from([9])))).toThrow('BAD_BACKUP')
  })
})
