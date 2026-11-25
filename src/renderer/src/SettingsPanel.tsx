import { useState } from 'react'
import type { Settings } from '../../shared/types'
import { MESSAGES } from './AuthScreen'
import { TimePicker } from './TimePicker'

type Props = { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; onPdf: () => void }

export function SettingsPanel({ settings: s, onChange, onClose, onPdf }: Props) {
  const [msg, setMsg] = useState('')
  async function backup() {
    const r = await window.api.backup()
    setMsg(r.ok ? (r.value ? 'پشتیبان ذخیره شد.' : '') : 'پشتیبان‌گیری ناموفق بود.')
  }
  async function restore() {
    if (!window.confirm('اطلاعات فعلی کنار گذاشته می‌شود (پاک نمی‌شود) و برنامه قفل می‌شود. ادامه می‌دهید؟')) return
    const r = await window.api.restore()
    if (!r.ok) setMsg('فایل پشتیبان معتبر نیست.')
    else if (r.value) window.location.reload()
  }
  const [pw, setPw] = useState({ old: '', next: '' })
  const [delPw, setDelPw] = useState('')
  const [armed, setArmed] = useState(false)

  async function changePassword() {
    const r = await window.api.changePassword(pw.old, pw.next)
    setMsg(r.ok ? 'رمز عوض شد.' : MESSAGES[r.error])
    if (r.ok) setPw({ old: '', next: '' })
  }
  async function deleteAccount() {
    const r = await window.api.deleteAccount(delPw)
    if (!r.ok) setMsg(MESSAGES[r.error])
  }
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...s, [k]: v })
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box form" onClick={(e) => e.stopPropagation()}>
        <h2>تنظیمات</h2>
        <label>تم
          <select value={s.theme} onChange={(e) => set('theme', e.target.value as Settings['theme'])}>
            <option value="system">مطابق سیستم</option><option value="light">روشن</option><option value="dark">تیره</option>
          </select>
        </label>
        <label>فونت
          <select value={s.font} onChange={(e) => set('font', e.target.value as Settings['font'])}>
            <option value="vazirmatn">وزیرمتن</option><option value="sahel">ساحل</option><option value="system">فونت سیستم</option>
          </select>
        </label>
        <label>اندازه‌ی متن ({s.fontSize})
          <input type="range" min={14} max={24} value={s.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))} />
        </label>
        <label>قفل خودکار بعد از (دقیقه)
          <input type="number" min={1} max={120} value={s.idleMinutes}
            onChange={(e) => set('idleMinutes', Number(e.target.value) || 5)} />
        </label>
        <div className="field">یادآور روزانه
          <TimePicker value={s.reminder} onChange={(v) => set('reminder', v)} />
        </div>
        <div className="row"><button className="link" onClick={() => void backup()}>پشتیبان‌گیری</button><button className="link" onClick={() => void restore()}>بازیابی از پشتیبان</button><button className="link" onClick={onPdf}>خروجی PDF همه‌ی خاطرات</button></div>
        <details className="acct">
          <summary>حساب</summary>
          <input type="password" placeholder="رمز فعلی" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
          <input type="password" placeholder="رمز جدید" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <button className="link" disabled={!pw.old || !pw.next} onClick={() => void changePassword()}>تغییر رمز</button>
          <hr />
          {!armed ? <button className="danger" onClick={() => setArmed(true)}>حذف این حساب…</button> : <>
            <small className="error">همه‌ی خاطرات این حساب برای همیشه پاک می‌شود. فایل پشتیبان ندارید؟ اول پشتیبان بگیرید.</small>
            <input type="password" placeholder="رمز این حساب" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
            <button className="danger" disabled={!delPw} onClick={() => void deleteAccount()}>حذف برای همیشه</button>
          </>}
        </details>
        {msg && <small role="status">{msg}</small>}
        <small className="sub">یادآور فقط وقتی کار می‌کند که برنامه باز باشد. </small>
        <button onClick={onClose}>بستن</button>
      </div>
    </div>
  )
}
