import { useEffect, useMemo, useState } from 'react'
import type { Entry, Settings } from '../../shared/types'
import { SettingsPanel } from './SettingsPanel'
import { StatsPanel } from './StatsPanel'
import { buildPdfHtml } from './pdfHtml'
import { onThisDay } from './stats'
import { Calendar } from './Calendar'
import { CalKind } from './calendarMath'
import { Editor } from './Editor'
import { Trash } from './Trash'

const today = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const fmt = (iso: string, kind: CalKind): string =>
  new Intl.DateTimeFormat(`fa-IR-u-ca-${kind === 'jalali' ? 'persian' : 'gregory'}`, { dateStyle: 'full' })
    .format(new Date(iso + 'T12:00:00'))

const plain = (e: Entry): string =>
  `${e.title} ${e.format === 'rich' ? e.body.replace(/<[^>]*>/g, ' ') : e.body} ${e.tags.join(' ')}`.toLowerCase()

type JournalProps = { onLock: () => void; settings: Settings; onSettings: (s: Settings) => void }

export function Journal({ onLock, settings, onSettings }: JournalProps) {
  const [panel, setPanel] = useState<'settings' | 'stats' | null>(null)
  const [focus, setFocus] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [kind, setKind] = useState<CalKind>('jalali')
  const [trashOpen, setTrashOpen] = useState(false)

  const reload = () => window.api.listEntries().then((r) => r.ok && setEntries(r.value))
  useEffect(() => { void reload() }, [])

  const allTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))].sort(), [entries])
  const memories = useMemo(() => onThisDay(entries, today()), [entries])
  const marked = useMemo(() => new Set(entries.map((e) => e.entryDate)), [entries])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) =>
      (!q || plain(e).includes(q)) && (!tag || e.tags.includes(tag)) && (!day || e.entryDate === day))
  }, [entries, query, tag, day])

  async function create() {
    const r = await window.api.saveEntry({
      title: '', body: '', format: 'rich', entryDate: day ?? today(), mood: null, tags: []
    })
    if (!r.ok) return
    setEntries((es) => [r.value, ...es])
    setActiveId(r.value.id)
  }

  async function trash(id: string) {
    if (!window.confirm('این خاطره به سطل زباله منتقل شود؟')) return
    const r = await window.api.trashEntry(id)
    if (!r.ok) return
    setEntries((es) => es.filter((e) => e.id !== id))
    setActiveId(null)
  }

  const onSaved = (e: Entry): void => setEntries((es) => es.map((x) => (x.id === e.id ? e : x)))
  const active = entries.find((e) => e.id === activeId)

  return (
    <div className={`layout${focus ? ' focus' : ''}`}>
      <aside>
        <div className="side-actions">
          <button onClick={() => void create()}>خاطره‌ی جدید</button>
          <span>
            <button className="link" onClick={() => setPanel('stats')}>آمار</button>
            <button className="link" onClick={() => setPanel('settings')}>تنظیمات</button>
            <button className="link" onClick={() => setTrashOpen(true)}>سطل زباله</button>
            <button className="link" onClick={onLock}>قفل</button>
          </span>
        </div>
        {memories.length > 0 && (
          <div className="memories">
            <strong>در چنین روزی</strong>
            {memories.map((m) => (
              <button key={m.id} className="link" onClick={() => setActiveId(m.id)}>
                {m.entryDate.slice(0, 4)} — {m.title || 'بدون عنوان'}
              </button>
            ))}
          </div>
        )}
        <Calendar kind={kind} onKind={setKind} marked={marked} selected={day} onSelect={setDay} />
        <input className="search" placeholder="جستجو…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {allTags.length > 0 && (
          <div className="tag-filter">
            {allTags.map((t) => (
              <button key={t} className={`chip${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>
            ))}
          </div>
        )}
        <ul>
          {shown.map((e) => (
            <li key={e.id} className={e.id === activeId ? 'active' : ''} onClick={() => setActiveId(e.id)}>
              <strong>{e.title || 'بدون عنوان'}</strong>
              <small>{fmt(e.entryDate, kind)}</small>
            </li>
          ))}
          {shown.length === 0 && <li className="none">خاطره‌ای پیدا نشد.</li>}
        </ul>
      </aside>
      <main>
        <button className="link focus-toggle" onClick={() => setFocus(!focus)}>
          {focus ? 'خروج از حالت تمرکز' : 'حالت تمرکز'}
        </button>
        {active ? <Editor key={active.id} entry={active} onSaved={onSaved} onTrash={(id) => void trash(id)} />
          : <p className="empty">یک خاطره انتخاب کنید یا خاطره‌ی جدید بسازید.</p>}
      </main>
      {panel === 'settings' && <SettingsPanel settings={settings} onChange={onSettings} onClose={() => setPanel(null)}
        onPdf={() => void window.api.exportPdf(buildPdfHtml(shown, (d) => fmt(d, kind)))} />}
      {panel === 'stats' && <StatsPanel entries={entries} today={today()} onClose={() => setPanel(null)} />}
      {trashOpen &&<Trash onClose={() => { setTrashOpen(false); void reload() }} />}
    </div>
  )
}
