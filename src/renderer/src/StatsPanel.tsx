import type { Entry } from '../../shared/types'
import { streak, wordCount } from './stats'

export function StatsPanel({ entries, today, onClose }: { entries: Entry[]; today: string; onClose: () => void }) {
  const fa = new Intl.NumberFormat('fa-IR')
  const words = entries.reduce((n, e) => n + wordCount(e), 0)

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>آمار</h2>
        <ul className="stats">
          <li><span>تعداد خاطره</span><strong>{fa.format(entries.length)}</strong></li>
          <li><span>تعداد کلمات</span><strong>{fa.format(words)}</strong></li>
          <li><span>روزهای پیاپی نوشتن</span><strong>{fa.format(streak(entries, today))}</strong></li>
        </ul>
        <button onClick={onClose}>بستن</button>
      </div>
    </div>
  )
}
