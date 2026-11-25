import { useState } from 'react'
import { isFuture, localToday } from '../../shared/dates'
import { CalKind, monthOf, shiftMonth } from './calendarMath'

const WEEK = {
  jalali: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
  gregorian: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
}

type Props = {
  kind: CalKind
  onKind: (k: CalKind) => void
  marked: Set<string> // ISO dates that have entries
  selected: string | null
  onSelect: (iso: string | null) => void
}

export function Calendar({ kind, onKind, marked, selected, onSelect }: Props) {
  const today = localToday()
  const [anchor, setAnchor] = useState(today)
  const month = monthOf(anchor, kind)
  const fa = new Intl.NumberFormat('fa-IR', { useGrouping: false })

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="link" onClick={() => setAnchor(shiftMonth(anchor, kind, -1))} aria-label="ماه قبل">›</button>
        <strong>{month.title}</strong>
        <button className="link" onClick={() => setAnchor(shiftMonth(anchor, kind, 1))} aria-label="ماه بعد">‹</button>
      </div>
      <div className="cal-grid">
        {WEEK[kind].map((w) => <span key={w} className="dow">{w}</span>)}
        {Array.from({ length: month.offset }, (_, i) => <span key={`o${i}`} />)}
        {month.cells.map((c) => (
          <button key={c.iso} disabled={isFuture(c.iso, today)}
            aria-current={c.iso === today ? 'date' : undefined}
            className={`day${marked.has(c.iso) ? ' has' : ''}${selected === c.iso ? ' sel' : ''}${c.iso === today ? ' today' : ''}`}
            onClick={() => onSelect(selected === c.iso ? null : c.iso)}>
            {fa.format(c.day)}
          </button>
        ))}
      </div>
      <button className="link" onClick={() => onKind(kind === 'jalali' ? 'gregorian' : 'jalali')}>
        {kind === 'jalali' ? 'نمایش میلادی' : 'نمایش شمسی'}
      </button>
    </div>
  )
}
