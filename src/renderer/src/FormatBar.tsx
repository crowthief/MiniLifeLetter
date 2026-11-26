import type { ReactNode } from 'react'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'

type Btn = { label: string; title: string; active: boolean; run: () => void }

/** The floating bar that appears when text is selected. Re-renders only when its own flags change. */
export function FormatBar({ editor }: { editor: Editor }): ReactNode {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }), h2: e.isActive('heading', { level: 2 }),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote')
    })
  })
  const c = () => editor.chain().focus()
  const btns: Btn[] = [
    { label: 'B', title: 'پررنگ', active: s.bold, run: () => c().toggleBold().run() },
    { label: 'I', title: 'مورب', active: s.italic, run: () => c().toggleItalic().run() },
    { label: 'S', title: 'خط‌خورده', active: s.strike, run: () => c().toggleStrike().run() },
    { label: 'H1', title: 'تیتر بزرگ', active: s.h1, run: () => c().toggleHeading({ level: 1 }).run() },
    { label: 'H2', title: 'تیتر کوچک', active: s.h2, run: () => c().toggleHeading({ level: 2 }).run() },
    { label: '•', title: 'فهرست', active: s.bullet, run: () => c().toggleBulletList().run() },
    { label: '1.', title: 'فهرست شماره‌دار', active: s.ordered, run: () => c().toggleOrderedList().run() },
    { label: '❝', title: 'نقل‌قول', active: s.quote, run: () => c().toggleBlockquote().run() }
  ]
  return (
    <BubbleMenu editor={editor} className="format-bar" options={{ placement: 'top' }}>
      {btns.map((b) => (
        <button key={b.title} type="button" title={b.title} aria-label={b.title}
          className={b.active ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={b.run}>
          {b.label}
        </button>
      ))}
    </BubbleMenu>
  )
}
