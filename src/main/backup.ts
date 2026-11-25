const MAGIC = Buffer.from('MLLBK1\n')

// File layout: MAGIC | uint32 vault length | vault.json | journal.db.
// Both parts are already encrypted on disk, so the backup needs no extra crypto and opens with the same password.
export function packBackup(vault: Buffer, db: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(vault.length)
  return Buffer.concat([MAGIC, len, vault, db])
}

/** Parses an untrusted backup file. Bounds the KDF cost so a crafted file cannot exhaust memory. */
export function unpackBackup(buf: Buffer): { vault: Buffer; db: Buffer } {
  const bad = (): never => { throw new Error('BAD_BACKUP') }
  if (buf.length < MAGIC.length + 4 || !buf.subarray(0, MAGIC.length).equals(MAGIC)) bad()
  const start = MAGIC.length + 4
  const end = start + buf.readUInt32BE(MAGIC.length)
  if (end >= buf.length) bad()
  const vault = buf.subarray(start, end)
  let v: { version?: number; kdf?: Record<string, unknown>; byPassword?: unknown; byRecovery?: unknown }
  try {
    v = JSON.parse(vault.toString('utf8'))
  } catch {
    return bad()
  }
  const k = v?.kdf
  const ok = v?.version === 1 && v.byPassword && v.byRecovery && typeof k?.salt === 'string' &&
    (k.memoryKiB as number) <= 1_048_576 && (k.iterations as number) <= 20 && (k.parallelism as number) <= 8
  if (!ok) bad()
  return { vault, db: buf.subarray(end) }
}
