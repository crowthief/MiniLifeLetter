import type { Editor } from '@tiptap/core'

/**
 * Smooth caret: hides the native blinking caret and draws one absolutely-positioned bar that glides to
 * the cursor with a CSS transition. Risks: the bar can sit a pixel or two off in mixed Persian/English
 * text, and it is only a visual layer. If anything cannot be measured it hides itself and the native
 * caret comes back, so typing never depends on it.
 *
 * Returns a cleanup function.
 */
export function attachSmoothCaret(editor: Editor, host: HTMLElement): () => void {
  const bar = document.createElement('div')
  bar.className = 'smooth-caret'
  host.appendChild(bar)

  let raf = 0
  const place = (): void => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const { from, empty } = editor.state.selection
      if (!editor.isFocused || !empty) { host.classList.remove('caret-on'); return }
      try {
        const c = editor.view.coordsAtPos(from)
        const h = host.getBoundingClientRect()
        const height = c.bottom - c.top
        if (!Number.isFinite(height) || height <= 0) throw new Error('no box')
        bar.style.transform = `translate(${c.left - h.left}px, ${c.top - h.top}px)`
        bar.style.height = `${height}px`
        host.classList.add('caret-on')
      } catch {
        host.classList.remove('caret-on') // fall back to the native caret
      }
    })
  }

  editor.on('selectionUpdate', place)
  editor.on('transaction', place)
  editor.on('focus', place)
  editor.on('blur', place)
  window.addEventListener('resize', place)
  place()

  return () => {
    cancelAnimationFrame(raf)
    editor.off('selectionUpdate', place)
    editor.off('transaction', place)
    editor.off('focus', place)
    editor.off('blur', place)
    window.removeEventListener('resize', place)
    host.classList.remove('caret-on')
    bar.remove()
  }
}
