import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createVault, setPassword, unlockWithPassword, unlockWithRecovery } from './vault'

// Small KDF cost so tests run fast. Production uses the defaults.
const FAST = { iterations: 1, memoryKiB: 1024, parallelism: 1 }

let dir: string
let path: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mll-'))
  path = join(dir, 'vault.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('vault', () => {
  it('unlocks with the right password and returns the same master key', async () => {
    const { master } = await createVault(path, 'correct horse', FAST)
    const again = await unlockWithPassword(path, 'correct horse')
    expect(again.equals(master)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    await createVault(path, 'correct horse', FAST)
    await expect(unlockWithPassword(path, 'wrong horse!')).rejects.toThrow('WRONG_PASSWORD')
  })

  it('rejects short passwords', async () => {
    await expect(createVault(path, 'short', FAST)).rejects.toThrow('PASSWORD_TOO_SHORT')
  })

  it('unlocks with the recovery phrase', async () => {
    const { master, recoveryPhrase } = await createVault(path, 'correct horse', FAST)
    expect(recoveryPhrase.split(' ')).toHaveLength(24)
    expect(unlockWithRecovery(path, recoveryPhrase).equals(master)).toBe(true)
  })

  it('rejects an invalid recovery phrase', async () => {
    await createVault(path, 'correct horse', FAST)
    expect(() => unlockWithRecovery(path, 'not a real phrase')).toThrow('INVALID_RECOVERY_PHRASE')
  })

  it('changes the password via recovery without changing the master key', async () => {
    const { master, recoveryPhrase } = await createVault(path, 'correct horse', FAST)
    const m = unlockWithRecovery(path, recoveryPhrase)
    await setPassword(path, m, 'brand new pass')
    await expect(unlockWithPassword(path, 'correct horse')).rejects.toThrow('WRONG_PASSWORD')
    expect((await unlockWithPassword(path, 'brand new pass')).equals(master)).toBe(true)
  })
})
