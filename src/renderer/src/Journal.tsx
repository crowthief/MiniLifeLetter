import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { AccountInfo, Entry, Settings } from '../../shared/types'
import { localToday } from '../../shared/dates'
import { SettingsPanel } from './SettingsPanel'
import { StatsPanel } from './StatsPanel'
import { buildPdfHtml } from './pdfHtml'
import { onThisDay } from './stats'
import { Calendar } from './Calendar'
import { CalKind } from './calendarMath'
import { Avatar } from './AuthScreen'
import { IconBtn, IconChart, IconExitFocus, IconFocus, IconGear, IconLock, IconPlus, IconTrash } from './Icons'
import { Trash } from './Trash'

// The editor (Tiptap/ProseMirror) is most of the app's code and the login screen does not need it.
const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })))

const today = localToday

const fmt = (iso: string, kind: CalKind): string =>
  new Intl.DateTimeFormat(`fa-IR-u-ca-${kind === 'jalali' ? 'persian' : 'gregory'}`, { dateStyle: 'full' })
    .format(new Date(iso + 'T12:00:00'))

const plain = (e: Entry): string =>
  `${e.title} ${e.format === 'rich' ? e.body.replace(/<[^>]*>/g, ' ') : e.body} ${e.tags.join(' ')}`.toLowerCase()

type JournalProps = {
  account: AccountInfo | null
  onLock: () => void
  settings: Settings
  onSettings: (s: Settings) => void
}

export function Journal({ account, onLock, settings, onSettings }: JournalProps) {
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
  // Searchable text is built once per change of the list, not once per keystroke in the search box.
  const haystack = useMemo(() => new Map(entries.map((e) => [e.id, plain(e)])), [entries])
  const deferredQuery = useDeferredValue(query)
  const shown = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return entries.filter((e) =>
      (!q || haystack.get(e.id)!.includes(q)) && (!tag || e.tags.includes(tag)) && (!day || e.entryDate === day))
  }, [entries, haystack, deferredQuery, tag, day])

  async function create() {
    const r = await window.api.saveEntry({
      title: '', body: '', format: 'rich', entryDate: day ?? today(), tags: []
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
        <header className="side-head">
          {account && <span className="who"><Avatar a={account} size={30} /><strong>{account.name}</strong></span>}
          <button className="new-btn" onClick={() => void create()}><IconPlus /> خاطره‌ی جدید</button>
          <nav className="tools" aria-label="ابزارها">
            <IconBtn icon={<IconChart />} label="آمار" onClick={() => setPanel('stats')} />
            <IconBtn icon={<IconTrash />} label="سطل زباله" onClick={() => setTrashOpen(true)} />
            <IconBtn icon={focus ? <IconExitFocus /> : <IconFocus />} label={focus ? 'خروج از حالت تمرکز' : 'حالت تمرکز'}
              active={focus} onClick={() => setFocus(!focus)} />
            <IconBtn icon={<IconGear />} label="تنظیمات" onClick={() => setPanel('settings')} />
            <IconBtn icon={<IconLock />} label="قفل" onClick={onLock} />
          </nav>
        </header>
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
        {focus && (
          <button className="focus-exit icon-btn" onClick={() => setFocus(false)} title="خروج از حالت تمرکز" aria-label="خروج از حالت تمرکز">
            <IconExitFocus />
          </button>
        )}
        {active ? <Suspense fallback={<p className="empty">…</p>}><Editor key={active.id} entry={active} kind={kind} onSaved={onSaved} onTrash={(id) => void trash(id)} /></Suspense>
          : <p className="empty">یک خاطره انتخاب کنید یا خاطره‌ی جدید بسازید.</p>}
      </main>
      {panel === 'settings' && <SettingsPanel settings={settings} onChange={onSettings} onClose={() => setPanel(null)}
        onPdf={() => void window.api.exportPdf(buildPdfHtml(shown, (d) => fmt(d, kind)))} />}
      {panel === 'stats' && <StatsPanel entries={entries} today={today()} onClose={() => setPanel(null)} />}
      {trashOpen &&<Trash onClose={() => { setTrashOpen(false); void reload() }} />}
    </div>
  )
}
