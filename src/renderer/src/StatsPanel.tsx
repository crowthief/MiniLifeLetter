import type { Entry } from '../../shared/types'
import { moodSeries, streak, wordCount } from './stats'

export function StatsPanel({ entries, today, onClose }: { entries: Entry[]; today: string; onClose: () => void }) {
  const fa = new Intl.NumberFormat('fa-IR')
  const words = entries.reduce((n, e) => n + wordCount(e), 0)
  const series = moodSeries(entries).slice(-60)
  const W = 400, H = 120
  const pts = series.map((p, i) =>
    `${series.length < 2 ? W / 2 : (i / (series.length - 1)) * W},${H - ((p.mood - 1) / 9) * H}`).join(' ')

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>آمار</h2>
        <ul className="stats">
          <li><span>تعداد خاطره</span><strong>{fa.format(entries.length)}</strong></li>
          <li><span>تعداد کلمات</span><strong>{fa.format(words)}</strong></li>
          <li><span>روزهای پیاپی نوشتن</span><strong>{fa.format(streak(entries, today))}</strong></li>
        </ul>
        <h3>حال‌وهوا در ۶۰ روز اخیر</h3>
        {series.length === 0 ? <p className="sub">هنوز حال‌وهوایی ثبت نشده.</p> : (
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="نمودار حال‌وهوا">
            <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
        )}
        <button onClick={onClose}>بستن</button>
      </div>
    </div>
  )
}
