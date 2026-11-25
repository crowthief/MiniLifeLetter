import { useState } from 'react'
import type { AuthError } from '../../shared/types'

const MESSAGES: Record<AuthError, string> = {
  PASSWORD_TOO_SHORT: 'رمز باید حداقل ۸ کاراکتر باشد.',
  WRONG_PASSWORD: 'رمز اشتباه است.',
  WRONG_RECOVERY_PHRASE: 'کلید بازیابی درست نیست.',
  INVALID_RECOVERY_PHRASE: 'کلید بازیابی باید ۲۴ کلمه‌ی معتبر باشد.',
  VAULT_EXISTS: 'قبلاً رمز ساخته شده است.',
  LOCKED: 'برنامه قفل است.',
  BAD_IMAGE: 'تصویر معتبر نیست (فقط PNG, JPEG, GIF, WebP تا ۱۰ مگابایت).',
  BAD_BACKUP: 'فایل پشتیبان معتبر نیست.',
  UNKNOWN: 'خطای ناشناخته.'
}

type Mode = 'login' | 'recover'

export function AuthScreen({ hasVault, onDone }: { hasVault: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shownPhrase, setShownPhrase] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function run(fn: () => Promise<{ ok: boolean; error?: AuthError }>): Promise<boolean> {
    setBusy(true)
    setError('')
    const r = await fn()
    setBusy(false)
    if (!r.ok && r.error) setError(MESSAGES[r.error])
    return r.ok
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasVault) {
      if (password !== confirm) return setError('رمز و تکرار آن یکسان نیستند.')
      const r = await window.api.createVault(password)
      if (r.ok) setShownPhrase(r.value.recoveryPhrase)
      else setError(MESSAGES[r.error])
      return
    }
    if (mode === 'login') {
      if (await run(() => window.api.unlock(password))) onDone()
    } else if (await run(() => window.api.unlockWithRecovery(phrase, password))) onDone()
  }

  if (shownPhrase) {
    return (
      <main className="auth">
        <h1>کلید بازیابی شما</h1>
        <p>این ۲۴ کلمه تنها راه بازیابی در صورت فراموشی رمز است. آن را روی کاغذ بنویسید و جای امنی نگه دارید. دوباره نمایش داده نمی‌شود.</p>
        <div className="phrase" dir="ltr">{shownPhrase}</div>
        <label className="check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          آن را ذخیره کردم
        </label>
        <button disabled={!saved} onClick={onDone}>ورود به دفتر</button>
      </main>
    )
  }

  const creating = !hasVault
  return (
    <main className="auth">
      <h1>MiniLifeLetter</h1>
      <p className="sub">
        {creating ? 'یک رمز اصلی بسازید. تمام خاطرات با آن رمزنگاری می‌شوند.' : mode === 'login' ? 'برای ورود رمز را وارد کنید.' : 'کلید بازیابی و یک رمز جدید وارد کنید.'}
      </p>
      <form onSubmit={submit}>
        {mode === 'recover' && (
          <textarea dir="ltr" rows={3} placeholder="۲۴ کلمه‌ی بازیابی" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        )}
        <input type="password" autoFocus placeholder={mode === 'recover' ? 'رمز جدید' : 'رمز اصلی'} value={password} onChange={(e) => setPassword(e.target.value)} />
        {creating && <input type="password" placeholder="تکرار رمز" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{creating ? 'ساخت رمز' : mode === 'login' ? 'ورود' : 'بازیابی'}</button>
      </form>
      {!creating && (
        <button className="link" onClick={() => { setMode(mode === 'login' ? 'recover' : 'login'); setError('') }}>
          {mode === 'login' ? 'رمز را فراموش کرده‌ام' : 'بازگشت به ورود'}
        </button>
      )}
    </main>
  )
}
