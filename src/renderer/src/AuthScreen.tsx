import { useState } from 'react'
import { ACCOUNT_COLORS, AccountInfo, AuthError, Status } from '../../shared/types'

export const MESSAGES: Record<AuthError, string> = {
  PASSWORD_TOO_SHORT: 'رمز باید حداقل ۸ کاراکتر باشد.',
  WRONG_PASSWORD: 'رمز اشتباه است.',
  WRONG_RECOVERY_PHRASE: 'کلید بازیابی درست نیست.',
  INVALID_RECOVERY_PHRASE: 'کلید بازیابی باید ۲۴ کلمه‌ی معتبر باشد.',
  VAULT_EXISTS: 'قبلاً رمز ساخته شده است.',
  LOCKED: 'برنامه قفل است.',
  BAD_IMAGE: 'تصویر معتبر نیست (فقط PNG, JPEG, GIF, WebP تا ۱۰ مگابایت).',
  BAD_BACKUP: 'فایل پشتیبان معتبر نیست.',
  BAD_NAME: 'نام حساب خالی است، بیش از ۳۰ حرف است یا تکراری است.',
  NO_ACCOUNT: 'این حساب پیدا نشد.',
  FUTURE_DATE: 'برای روزهای آینده نمی‌شود خاطره ثبت کرد.',
  UNKNOWN: 'خطای ناشناخته.'
}

type Step = 'pick' | 'login' | 'recover' | 'new' | 'adopt'

export function Avatar({ a, size = 44 }: { a: AccountInfo; size?: number }) {
  return (
    <span className="avatar" style={{ background: a.color, width: size, height: size, fontSize: size * 0.45 }}>
      {[...a.name][0]}
    </span>
  )
}

function Phrase({ phrase, onDone }: { phrase: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  return (
    <main className="auth">
      <h1>کلید بازیابی شما</h1>
      <p>این ۲۴ کلمه تنها راه بازیابی در صورت فراموشی رمز است. آن را روی کاغذ بنویسید و جای امنی نگه دارید. دوباره نمایش داده نمی‌شود.</p>
      <div className="phrase" dir="ltr">{phrase}</div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        آن را ذخیره کردم
      </label>
      <button disabled={!saved} onClick={onDone}>ورود به دفتر</button>
    </main>
  )
}

function NewAccountForm(p: {
  adopt: boolean; onCancel?: () => void; onCreated: (phrase: string | null) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(ACCOUNT_COLORS[0])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!p.adopt && password !== confirm) return setError('رمز و تکرار آن یکسان نیستند.')
    setBusy(true)
    const r = p.adopt
      ? await window.api.adoptLegacy(name, color)
      : await window.api.createAccount(name, color, password)
    setBusy(false)
    if (!r.ok) return setError(MESSAGES[r.error])
    p.onCreated('recoveryPhrase' in r.value ? r.value.recoveryPhrase : null)
  }

  return (
    <main className="auth">
      <h1>{p.adopt ? 'نام حساب شما' : 'حساب جدید'}</h1>
      <p className="sub">
        {p.adopt
          ? 'خاطرات و رمز فعلی شما بدون تغییر به این حساب می‌روند.'
          : 'هر حساب رمز و خاطرات جداگانه‌ی خودش را دارد.'}
      </p>
      <form onSubmit={submit}>
        <input autoFocus placeholder="نام حساب" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="colors" role="radiogroup" aria-label="رنگ حساب">
          {ACCOUNT_COLORS.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c}
              className={`swatch${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        {!p.adopt && <>
          <input type="password" placeholder="رمز اصلی" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" placeholder="تکرار رمز" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </>}
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" disabled={busy || !name.trim()}>{p.adopt ? 'ادامه' : 'ساخت حساب'}</button>
      </form>
      {p.onCancel && <button className="link" onClick={p.onCancel}>بازگشت</button>}
    </main>
  )
}

function LoginForm({ account, onBack, onDone }: { account: AccountInfo; onBack: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'recover'>('login')
  const [password, setPassword] = useState('')
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = mode === 'login' ? await window.api.unlock(password) : await window.api.unlockWithRecovery(phrase, password)
    setBusy(false)
    if (r.ok) onDone()
    else setError(MESSAGES[r.error])
  }

  return (
    <main className="auth">
      <Avatar a={account} size={64} />
      <h1>{account.name}</h1>
      <p className="sub">{mode === 'login' ? 'برای ورود رمز را وارد کنید.' : 'کلید بازیابی و یک رمز جدید وارد کنید.'}</p>
      <form onSubmit={submit}>
        {mode === 'recover' && (
          <textarea dir="ltr" rows={3} placeholder="۲۴ کلمه‌ی بازیابی" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        )}
        <input type="password" autoFocus placeholder={mode === 'recover' ? 'رمز جدید' : 'رمز اصلی'}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="error" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{mode === 'login' ? 'ورود' : 'بازیابی'}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'login' ? 'recover' : 'login'); setError('') }}>
        {mode === 'login' ? 'رمز را فراموش کرده‌ام' : 'بازگشت به ورود'}
      </button>
      <button className="link" onClick={onBack}>تغییر حساب</button>
    </main>
  )
}

export function AuthScreen({ status, onDone }: { status: Status; onDone: () => void }) {
  const [step, setStep] = useState<Step>(
    status.legacy ? 'adopt' : status.accounts.length === 0 ? 'new' : 'pick')
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [phrase, setPhrase] = useState<string | null>(null)

  if (phrase) return <Phrase phrase={phrase} onDone={onDone} />

  if (step === 'adopt' || step === 'new') {
    return (
      <NewAccountForm adopt={step === 'adopt'}
        onCancel={status.accounts.length > 0 ? () => setStep('pick') : undefined}
        onCreated={(ph) => { if (ph) setPhrase(ph); else { setStep('pick'); onDone() } }} />
    )
  }

  async function choose(a: AccountInfo) {
    const r = await window.api.selectAccount(a.id)
    if (r.ok) { setAccount(a); setStep('login') }
  }

  if (step === 'login' && account) return <LoginForm account={account} onBack={() => setStep('pick')} onDone={onDone} />

  return (
    <main className="auth">
      <h1>MiniLifeLetter</h1>
      <p className="sub">حساب خود را انتخاب کنید.</p>
      <ul className="accounts">
        {status.accounts.map((a) => (
          <li key={a.id}>
            <button className="account" onClick={() => void choose(a)}>
              <Avatar a={a} /> <span>{a.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="link" onClick={() => setStep('new')}>+ حساب جدید</button>
    </main>
  )
}
