import { readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, Settings } from '../shared/types'

const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T =>
  ok.includes(v as T) ? (v as T) : d
const num = (v: unknown, min: number, max: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d

/** Validates untrusted input (IPC or disk) into a safe Settings object. */
export function sanitize(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const D = DEFAULT_SETTINGS
  return {
    theme: pick(r.theme, ['system', 'light', 'dark'], D.theme),
    font: pick(r.font, ['vazirmatn', 'sahel', 'system'], D.font),
    fontSize: num(r.fontSize, 14, 24, D.fontSize),
    idleMinutes: num(r.idleMinutes, 1, 120, D.idleMinutes),
    reminder: typeof r.reminder === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.reminder) ? r.reminder : ''
  }
}

export function loadSettings(path: string): Settings {
  try {
    return sanitize(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(path: string, s: Settings): void {
  writeFileSync(path, JSON.stringify(s))
}
