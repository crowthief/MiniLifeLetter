import { describe, expect, it } from 'vitest'
import type { Entry } from '../../shared/types'
import { buildPdfHtml } from './pdfHtml'

const e = (o: Partial<Entry>): Entry => ({
  id: '1', title: 't', body: 'b', format: 'rich', entryDate: '2026-01-02', createdAt: 0, updatedAt: 0,
  mood: null, deletedAt: null, tags: [], ...o
})

describe('buildPdfHtml', () => {
  it('escapes title, tags and markdown bodies', () => {
    const h = buildPdfHtml([e({ title: '<script>x</script>', format: 'markdown', body: '<img src=x onerror=1>', tags: ['<b>'] })], (d) => d)
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('<img')
    expect(h).toContain('&lt;img')
    expect(h).toContain('#&lt;b&gt;')
  })
  it('keeps rich HTML and orders oldest first', () => {
    const h = buildPdfHtml([e({ title: 'B', entryDate: '2026-02-01', body: '<p>x</p>' }), e({ title: 'A', entryDate: '2026-01-01' })], (d) => d)
    expect(h.indexOf('A')).toBeLessThan(h.indexOf('B'))
    expect(h).toContain('<p>x</p>')
  })
})
