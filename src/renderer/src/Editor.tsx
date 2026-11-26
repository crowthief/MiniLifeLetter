import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import type { Entry, EntryFormat } from '../../shared/types'
import { FormatBar } from './FormatBar'
import { FreshText } from './freshText'
import { SlashMenu } from './SlashMenu'
import { attachSmoothCaret } from './smoothCaret'
import { dayLabel, readingMinutes, wordsOf } from './writing'
import type { CalKind } from './calendarMath'

type Props = { entry: Entry; kind: CalKind; onSaved: (e: Entry) => void; onTrash: (id: string) => void }

const GOAL = 200 // daily words goal shown on the progress bar
const fa = new Intl.NumberFormat('fa-IR')

export function Editor({ entry, kind, onSaved, onTrash }: Props) {
  const [title, setTitle] = useState(entry.title)
  const [tags, setTags] = useState<string[]>(entry.tags)
  const [format, setFormat] = useState<EntryFormat>(entry.format)
  const [mdText, setMdText] = useState(entry.format === 'markdown' ? entry.body : '')
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [error, setError] = useState('')
  const [typewriter, setTypewriter] = useState(false)
  const [words, setWords] = useState(() => wordsOf(entry.format === 'rich' ? entry.body.replace(/<[^>]*>/g, ' ') : entry.body))
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const bodyRef = useRef(entry.body)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const latest = useRef({ title, tags, format })
  latest.current = { title, tags, format }

  async function persist() {
    const l = latest.current
    const r = await window.api.saveEntry({
      id: entry.id, title: l.title, body: bodyRef.current, format: l.format, entryDate: entry.entryDate, tags: l.tags
    })
    if (r.ok) onSaved(r.value)
    setStatus('saved')
  }

  function schedule() {
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void persist() }, 600)
  }

  const editor = useEditor({
    extensions: [StarterKit, Image, Markdown, FreshText],
    content: entry.body,
    contentType: entry.format === 'markdown' ? 'markdown' : 'html',
    // Only the format bar and word count read editor state, so typing does not re-render this whole tree.
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      if (latest.current.format !== 'rich') return
      bodyRef.current = editor.getHTML()
      setWords(wordsOf(editor.getText()))
      schedule()
    }
  })

  // Flush a pending save when switching to another entry.
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void persist() }
  }, [])

  // Smooth caret: only while the rich editor is shown.
  useEffect(() => {
    if (!editor || !host || format !== 'rich') return
    return attachSmoothCaret(editor, host)
  }, [editor, host, format])

  const selecting = useEditorState({ editor, selector: ({ editor: e }) => !!e && !e.state.selection.empty })

  function switchFormat(next: EntryFormat) {
    if (!editor || next === format) return
    if (next === 'markdown') {
      const md = editor.getMarkdown()
      bodyRef.current = md
      setMdText(md)
    } else {
      editor.commands.setContent(mdText, { contentType: 'markdown' })
      bodyRef.current = editor.getHTML()
    }
    latest.current = { ...latest.current, format: next }
    setFormat(next)
    setWords(wordsOf(next === 'markdown' ? bodyRef.current : (editor.getText() ?? '')))
    schedule()
  }

  async function addImage(file: File) {
    setError('')
    const r = await window.api.addImage(entry.id, file.type, new Uint8Array(await file.arrayBuffer()))
    if (!r.ok) return setError('تصویر معتبر نیست (فقط PNG، JPEG، GIF و WebP تا ۱۰ مگابایت).')
    if (format === 'rich') editor?.chain().focus().setImage({ src: r.value }).run()
    else {
      const md = `${mdText}\n\n![](${r.value})\n`
      bodyRef.current = md
      setMdText(md)
      schedule()
    }
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, '')
    setTagInput('')
    if (!t || tags.includes(t)) return
    setTags([...tags, t])
    latest.current.tags = [...tags, t]
    schedule()
  }

  const progress = Math.min(1, words / GOAL)
  const label = useMemo(() => dayLabel(entry.entryDate, kind), [entry.entryDate, kind])

  return (
    <section className={`editor paper${typewriter ? ' typewriter' : ''}`}>
      <p className="day-label">{label}</p>
      <input className="title" placeholder="عنوان (اختیاری)" value={title}
        onChange={(e) => { setTitle(e.target.value); schedule() }} />
      <div className="meta">
        <button className="link" onClick={() => switchFormat(format === 'rich' ? 'markdown' : 'rich')}>
          {format === 'rich' ? 'حالت نشانه‌گذاری' : 'حالت متن غنی'}
        </button>
        <button className={`link${typewriter ? ' on' : ''}`} aria-pressed={typewriter} onClick={() => setTypewriter(!typewriter)}>
          حالت ماشین‌تحریر
        </button>
        <button className="link" onClick={() => fileRef.current?.click()}>افزودن تصویر</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addImage(f) }} />
        <span className="status" role="status">{status === 'saving' ? 'در حال ذخیره…' : 'ذخیره شد'}</span>
        <button className="danger" onClick={() => onTrash(entry.id)}>حذف</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="tags">
        {tags.map((t) => (
          <button key={t} className="chip on" title="حذف برچسب"
            onClick={() => { const n = tags.filter((x) => x !== t); setTags(n); latest.current.tags = n; schedule() }}>#{t} ×</button>
        ))}
        <input placeholder="برچسب جدید…" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
      </div>
      <div className="body-host" ref={setHost}>
        {format === 'rich' && editor ? (
          <>
            <EditorContent editor={editor} className="body" />
            <FormatBar editor={editor} />
            <SlashMenu editor={editor} host={host} onImage={() => fileRef.current?.click()} />
          </>
        ) : (
          <textarea className="md" dir="auto" value={mdText}
            onChange={(e) => { setMdText(e.target.value); bodyRef.current = e.target.value; setWords(wordsOf(e.target.value)); schedule() }} />
        )}
      </div>
      <footer className="write-stats" aria-label="آمار نوشتن" data-selecting={selecting}>
        <span>{fa.format(words)} کلمه</span>
        <span>حدود {fa.format(readingMinutes(words))} دقیقه خواندن</span>
        <span className="goal" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL} aria-valuenow={Math.min(words, GOAL)}
          aria-label="هدف نوشتن امروز"><i style={{ width: `${progress * 100}%` }} /></span>
      </footer>
    </section>
  )
}
