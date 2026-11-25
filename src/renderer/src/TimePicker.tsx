import { useState } from 'react'
import { hourAt, ringOf } from './clockMath'

const fa = new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2, useGrouping: false })
const pad = (n: number): string => String(n).padStart(2, '0')

// Clock face geometry (viewBox 200x200, center 100,100)
const C = 100
const point = (value: number, steps: number, r: number): [number, number] => {
  const a = (value / steps) * 2 * Math.PI - Math.PI / 2
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

type Props = { value: string; onChange: (v: string) => void }

/** Analog clock for choosing a 24-hour time. '' means the reminder is off. */
export function TimePicker({ value, onChange }: Props) {
  const on = value !== ''
  const [h, m] = on ? value.split(':').map(Number) : [21, 0]
  const [mode, setMode] = useState<'h' | 'm'>('h')

  const set = (nh: number, nm: number) => onChange(`${pad(nh)}:${pad(nm)}`)

  // Hours: outer ring 12, 1..11 and inner ring 0, 13..23, both clockwise from the top (see clockMath).
  const hourNodes = Array.from({ length: 24 }, (_, v) => {
    const { pos, inner } = ringOf(v)
    const [x, y] = point(pos, 12, inner ? 52 : 80)
    return { v, x, y }
  })
  const minNodes = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = point(i, 12, 80)
    return { v: i * 5, x, y }
  })

  const ring = ringOf(h)
  const [hx, hy] = mode === 'h' ? point(ring.pos, 12, ring.inner ? 52 : 80) : point(m / 5, 12, 80)

  // Pointer on the face: pick the nearest hour or minute.
  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 200 - C
    const y = ((e.clientY - r.top) / r.height) * 200 - C
    let ang = Math.atan2(y, x) + Math.PI / 2
    if (ang < 0) ang += 2 * Math.PI
    if (mode === 'h') {
      const pos = Math.round((ang / (2 * Math.PI)) * 12) % 12
      const inner = Math.hypot(x, y) < 66
      set(hourAt(pos, inner), m)
      if (e.type === 'pointerup') setMode('m')
    } else {
      set(h, Math.round((ang / (2 * Math.PI)) * 60) % 60)
    }
  }

  if (!on) {
    return (
      <div className="clock off">
        <button type="button" className="link" onClick={() => set(21, 0)}>روشن کردن یادآور</button>
      </div>
    )
  }

  return (
    <div className="clock" dir="ltr">
      <div className="clock-head">
        <button type="button" className={`seg${mode === 'h' ? ' on' : ''}`} onClick={() => setMode('h')}>{fa.format(h)}</button>
        <span>:</span>
        <button type="button" className={`seg${mode === 'm' ? ' on' : ''}`} onClick={() => setMode('m')}>{fa.format(m)}</button>
      </div>
      <svg viewBox="0 0 200 200" className="face" role="group" aria-label={mode === 'h' ? 'انتخاب ساعت' : 'انتخاب دقیقه'}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e) }}
        onPointerMove={(e) => { if (e.buttons) pick(e) }} onPointerUp={pick}>
        <circle cx={C} cy={C} r="96" className="dial" />
        <line x1={C} y1={C} x2={hx} y2={hy} className="hand" />
        <circle cx={C} cy={C} r="3" className="hub" />
        <circle cx={hx} cy={hy} r="15" className="knob" />
        {(mode === 'h' ? hourNodes : minNodes).map((n) => {
          const sel = mode === 'h' ? n.v === h : n.v === m
          return (
            <text key={n.v} x={n.x} y={n.y} className={`num${sel ? ' sel' : ''}${mode === 'h' && ringOf(n.v).inner ? ' small' : ''}`}
              textAnchor="middle" dominantBaseline="central">{fa.format(n.v)}</text>
          )
        })}
      </svg>
      <button type="button" className="link" onClick={() => onChange('')}>خاموش کردن یادآور</button>
    </div>
  )
}
