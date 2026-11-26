import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReplaceStep } from '@tiptap/pm/transform'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const MAX_LEN = 40 // a long paste or a restore must not animate: only typing-sized insertions do

/**
 * Range to fade in for one transaction, or null. Only a single, plain-text insertion that replaces
 * nothing qualifies: Enter, deletes, pastes of blocks, input rules and undo all return null.
 */
export function freshRange(
  stepCount: number, from: number, to: number, size: number, plainText: boolean
): [number, number] | null {
  if (stepCount !== 1 || !plainText || from !== to || size <= 0 || size > MAX_LEN) return null
  return [from, from + size]
}

const key = new PluginKey<DecorationSet>('freshText')

/**
 * Wraps newly typed characters in `span.fresh`, which CSS fades in. Decorations are view-only, so the
 * document, saving and markdown export are unchanged. The mark disappears on the next edit.
 */
export const FreshText = Extension.create({
  name: 'freshText',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            if (!tr.docChanged) return set.map(tr.mapping, tr.doc)
            const s = tr.steps[0]
            const sl = s instanceof ReplaceStep ? s.slice : null
            const plain = !!sl && sl.openStart === 0 && sl.openEnd === 0 && sl.content.childCount === 1 &&
              !!sl.content.firstChild?.isText
            const r = s instanceof ReplaceStep && sl
              ? freshRange(tr.steps.length, s.from, s.to, sl.size, plain) : null
            return r ? DecorationSet.create(tr.doc, [Decoration.inline(r[0], r[1], { class: 'fresh' })]) : DecorationSet.empty
          }
        },
        props: { decorations: (state) => key.getState(state) }
      })
    ]
  }
})
