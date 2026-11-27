/**
 * Which graphs the Convert, Test and Minimize canvases show: the first
 * graph only, the second only, or both. Remembered per tab in this browser.
 */

import { create } from 'zustand'

/** `first` and `second` show one graph on the whole canvas; `both` shows the two. */
export type PaneView = 'first' | 'second' | 'both'

/** The tabs that have two graphs. */
export type SplitTab = 'convert' | 'test' | 'minimize'

const KEY = 'enfa-sim.panes.v1'
const DEFAULTS: Record<SplitTab, PaneView> = { convert: 'both', test: 'both', minimize: 'both' }
const VIEWS: readonly PaneView[] = ['first', 'second', 'both']

function read(): Record<SplitTab, PaneView> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<SplitTab, unknown>>
    const pick = (t: SplitTab) => (VIEWS.includes(raw[t] as PaneView) ? (raw[t] as PaneView) : DEFAULTS[t])
    return { convert: pick('convert'), test: pick('test'), minimize: pick('minimize') }
  } catch {
    return { ...DEFAULTS }
  }
}

export interface PanesState {
  views: Record<SplitTab, PaneView>
  setView: (tab: SplitTab, view: PaneView) => void
}

export const usePanes = create<PanesState>((set, get) => ({
  views: read(),
  setView: (tab, view) => {
    const views = { ...get().views, [tab]: view }
    set({ views })
    try {
      localStorage.setItem(KEY, JSON.stringify(views))
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit.
    }
  },
}))
