import type { Entry } from '../../shared/types'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** HTML for the PDF. Markdown entries are escaped and shown as plain text, rich entries keep their HTML. */
export function buildPdfHtml(entries: Entry[], dateLabel: (iso: string) => string): string {
  return [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.createdAt - b.createdAt)
    .map((e) => {
      const body = e.format === 'rich' ? e.body : `<div style="white-space:pre-wrap">${esc(e.body)}</div>`
      const tags = e.tags.length ? ` · ${e.tags.map((t) => '#' + esc(t)).join(' ')}` : ''
      return `<article><h1>${esc(e.title || 'بدون عنوان')}</h1><small>${esc(dateLabel(e.entryDate))}${tags}</small>${body}</article>`
    }).join('')
}
