export interface SlashItem {
  id: string
  title: string // shown in Persian
  keywords: string // extra words that also match, including the English ones people type from habit
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'h1', title: 'تیتر بزرگ', keywords: 'h1 heading title' },
  { id: 'h2', title: 'تیتر کوچک', keywords: 'h2 heading' },
  { id: 'bullet', title: 'فهرست', keywords: 'list bullet' },
  { id: 'ordered', title: 'فهرست شماره‌دار', keywords: 'list number ordered' },
  { id: 'quote', title: 'نقل‌قول', keywords: 'quote blockquote' },
  { id: 'rule', title: 'خط جداکننده', keywords: 'divider line hr' },
  { id: 'image', title: 'تصویر', keywords: 'image photo picture' }
]

/**
 * The text typed after a "/" when the cursor is right behind a slash command, else null.
 * `before` is the text of the current line up to the cursor. The slash must start a word,
 * so "a/b" and "http://x" never open the menu, and a space ends the command.
 */
export function slashQuery(before: string): string | null {
  const m = /(?:^|\s)\/([^\s/]*)$/.exec(before)
  return m ? m[1] : null
}

export function filterSlash(q: string): SlashItem[] {
  const n = q.trim().toLowerCase()
  if (!n) return SLASH_ITEMS
  return SLASH_ITEMS.filter((i) => i.title.includes(n) || i.keywords.includes(n))
}
