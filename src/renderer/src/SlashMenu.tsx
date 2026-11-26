import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { filterSlash, slashQuery } from './slashItems'

type Pos = { left: number; top: number }

/** The "/" menu. Opens when the text before the cursor is a slash command, closes on Esc or a space. */
export function SlashMenu({ editor, host, onImage }: { editor: Editor; host: HTMLElement | null; onImage: () => void }) {
  const [q, setQ] = useState<string | null>(null)
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0 })
  const [i, setI] = useState(0)
  const dismissed = useRef(false)
  const items = q === null ? [] : filterSlash(q)

  useEffect(() => {
    const update = (): void => {
      const { $from, empty } = editor.state.selection
      const text = empty ? $from.parent.textBetween(0, $from.parentOffset, undefined, '\0') : ''
      const next = empty && $from.parent.isTextblock ? slashQuery(text) : null
      if (next === null) dismissed.current = false
      const show = next !== null && !dismissed.current
      setQ(show ? next : null)
      if (show && host) {
        const c = editor.view.coordsAtPos($from.pos)
        const h = host.getBoundingClientRect()
        // Text runs right to left, so the menu hangs from the cursor toward the left and is kept inside
        // the page: it must not slide under the sidebar or past the edge.
        const W = 200
        setPos({ left: Math.min(Math.max(0, c.right - h.left - W), Math.max(0, h.width - W)), top: c.bottom - h.top + 6 })
      }
    }
    editor.on('transaction', update)
    return () => { editor.off('transaction', update) }
  }, [editor, host])

  useEffect(() => setI(0), [q])

  function run(id: string): void {
    const { $from } = editor.state.selection
    const len = (q?.length ?? 0) + 1 // the slash plus what was typed after it
    const chain = editor.chain().focus().deleteRange({ from: $from.pos - len, to: $from.pos })
    if (id === 'h1') chain.setHeading({ level: 1 }).run()
    else if (id === 'h2') chain.setHeading({ level: 2 }).run()
    else if (id === 'bullet') chain.toggleBulletList().run()
    else if (id === 'ordered') chain.toggleOrderedList().run()
    else if (id === 'quote') chain.setBlockquote().run()
    else if (id === 'rule') chain.setHorizontalRule().run()
    else { chain.run(); onImage() }
    setQ(null)
  }

  // Capture phase so the editor does not also handle Enter and the arrows.
  useEffect(() => {
    if (q === null || items.length === 0) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setI((n) => (n + 1) % items.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setI((n) => (n - 1 + items.length) % items.length) }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); run(items[i].id) }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismissed.current = true; setQ(null) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (q === null || items.length === 0) return null
  return (
    <ul className="slash-menu" role="listbox" style={{ left: pos.left, top: pos.top }}>
      {items.map((it, n) => (
        <li key={it.id} role="option" aria-selected={n === i} className={n === i ? 'on' : ''}
          onMouseDown={(e) => { e.preventDefault(); run(it.id) }} onMouseEnter={() => setI(n)}>
          {it.title}
        </li>
      ))}
    </ul>
  )
}
