import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import type { Entry, EntryFormat } from '../../shared/types'

type Props = { entry: Entry; onSaved: (e: Entry) => void; onTrash: (id: string) => void }

export function Editor({ entry, onSaved, onTrash }: Props) {
  const [title, setTitle] = useState(entry.title)
  const [mood, setMood] = useState<number | null>(entry.mood)
  const [tags, setTags] = useState<string[]>(entry.tags)
  const [format, setFormat] = useState<EntryFormat>(entry.format)
  const [mdText, setMdText] = useState(entry.format === 'markdown' ? entry.body : '')
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [error, setError] = useState('')
  const bodyRef = useRef(entry.body)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ title, mood, tags, format })
  latest.current = { title, mood, tags, format }

  async function persist() {
    const l = latest.current
    const r = await window.api.saveEntry({
      id: entry.id, title: l.title, body: bodyRef.current, format: l.format,
      entryDate: entry.entryDate, mood: l.mood, tags: l.tags
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
    extensions: [StarterKit, Image, Markdown],
    content: entry.body,
    contentType: entry.format === 'markdown' ? 'markdown' : 'html',
    onUpdate: ({ editor }) => {
      if (latest.current.format !== 'rich') return
      bodyRef.current = editor.getHTML()
      schedule()
    }
  })

  // Flush a pending save when switching to another entry.
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void persist() }
  }, [])

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
    schedule()
  }

  async function addImage(file: File) {
    setError('')
    const r = await window.api.addImage(entry.id, file.type, new Uint8Array(await file.arrayBuffer()))
    if (!r.ok) return setError('تصویر معتبر نیست (PNG, JPEG, GIF, WebP تا ۱۰ مگابایت).')
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

  return (
    <section className="editor">
      <input className="title" placeholder="عنوان (اختیاری)" value={title}
        onChange={(e) => { setTitle(e.target.value); schedule() }} />
      <div className="meta">
        <label>
          حال‌وهوا
          <select value={mood ?? ''} onChange={(e) => { setMood(e.target.value ? Number(e.target.value) : null); schedule() }}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <button className="link" onClick={() => switchFormat(format === 'rich' ? 'markdown' : 'rich')}>
          {format === 'rich' ? 'حالت Markdown' : 'حالت متن غنی'}
        </button>
        <label className="link filebtn">
          افزودن تصویر
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addImage(f) }} />
        </label>
        <span className="status">{status === 'saving' ? 'در حال ذخیره…' : 'ذخیره شد'}</span>
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
      {format === 'rich'
        ? <EditorContent editor={editor} className="body" />
        : <textarea className="md" dir="auto" value={mdText}
            onChange={(e) => { setMdText(e.target.value); bodyRef.current = e.target.value; schedule() }} />}
    </section>
  )
}
