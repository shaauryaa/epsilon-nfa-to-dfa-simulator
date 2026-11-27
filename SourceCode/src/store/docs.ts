/**
 * Which info dialog is open (Docs or About) and, for Docs, which theory
 * card to scroll to. Any tab can link to a card with `showDocs(topic)`.
 */

import { create } from 'zustand'

/** The theory cards in the Docs dialog, in order. */
export type DocTopic = 'enfa' | 'regex' | 'closure' | 'move' | 'subset' | 'dead' | 'minimise' | 'complexity' | 'howto' | 'shortcuts'

export interface DocsState {
  dialog: 'docs' | 'about' | null
  /** The card to scroll to when Docs opens, or `null` for the top. */
  topic: DocTopic | null
  showDocs: (topic?: DocTopic) => void
  showAbout: () => void
  close: () => void
}

export const useDocs = create<DocsState>((set) => ({
  dialog: null,
  topic: null,
  showDocs: (topic) => set({ dialog: 'docs', topic: topic ?? null }),
  showAbout: () => set({ dialog: 'about', topic: null }),
  close: () => set({ dialog: null }),
}))
