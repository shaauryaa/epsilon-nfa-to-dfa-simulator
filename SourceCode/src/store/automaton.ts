/**
 * The app store: the current ε-NFA, everything derived from it, the text
 * editor draft, node positions for the graph, undo history and UI state.
 */

import { create } from 'zustand'
import { fromJSON, parseText, ParseError, toJSON, toText, type ENFA } from '../core'
import { getPreset } from '../presets'
import { layoutLR, type XY } from '../graph/layout'
import { mergedEdges } from '../model/graph'
import { cloneENFA } from '../model/edits'
import type { FocusTarget } from '../model/issues'
import { derive, type Derived } from './derive'

export type Tab = 'define' | 'convert' | 'test' | 'minimize'

/** The app's sections, in tab order. */
export const TABS: { id: Tab; label: string }[] = [
  { id: 'define', label: 'Define' },
  { id: 'convert', label: 'Convert' },
  { id: 'test', label: 'Test' },
  { id: 'minimize', label: 'Minimize' },
]
/** Whether the "Text format" section of the builder is expanded. */
export type EditorView = 'table' | 'text'
/** A transition-table cell the pointer is over; the graph highlights it. */
export interface HoverCell {
  state: string
  symbol: string
}
/** Which editor produced a change. `text` changes keep the user's own text. */
export type Origin = 'init' | 'table' | 'text' | 'graph' | 'preset' | 'new' | 'import' | 'undo' | 'redo'

export const DEFAULT_PRESET = 'thompson-abb'
const KEY_NFA = 'enfa-sim.nfa.v1'
const KEY_PRESET = 'enfa-sim.preset.v1'
const KEY_TAB = 'enfa-sim.tab.v1'
const HISTORY_LIMIT = 50

interface Snapshot {
  nfa: ENFA
  presetId: string | null
  positions: Record<string, XY>
}

export interface AppState extends Derived {
  nfa: ENFA
  presetId: string | null
  origin: Origin
  textDraft: string
  parseError: { line: number; message: string } | null
  positions: Record<string, XY>
  /** Bumped whenever the graph should re-fit the view (preset, import, re-layout). */
  layoutNonce: number
  history: Snapshot[]
  /** Snapshots undone and not yet redone; cleared by any new edit. */
  future: Snapshot[]
  activeTab: Tab
  editorView: EditorView
  focusRequest: { target: FocusTarget; nonce: number } | null
  hoverCell: HoverCell | null

  /** Replaces the machine. `rename` moves a node position to a state's new name. */
  commit: (nfa: ENFA, origin: Origin, opts?: { presetId?: string | null; rename?: [string, string] }) => void
  setTextDraft: (text: string) => void
  loadPreset: (id: string) => void
  undo: () => boolean
  redo: () => boolean
  setPosition: (id: string, xy: XY) => void
  relayout: () => void
  setActiveTab: (tab: Tab) => void
  setEditorView: (view: EditorView) => void
  requestFocus: (target: FocusTarget) => void
  setHoverCell: (cell: HoverCell | null) => void
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be full, blocked or unavailable (private mode); the app still works without it.
  }
}

function initialMachine(): { nfa: ENFA; presetId: string | null } {
  const saved = readStorage(KEY_NFA)
  if (saved) {
    try {
      const nfa = fromJSON(saved)
      const presetId = readStorage(KEY_PRESET)
      return { nfa, presetId: presetId && getPreset(presetId) ? presetId : null }
    } catch {
      // Corrupt or outdated data: fall back to the default preset.
    }
  }
  return { nfa: cloneENFA(getPreset(DEFAULT_PRESET)!.nfa), presetId: DEFAULT_PRESET }
}

function initialTab(): Tab {
  const t = readStorage(KEY_TAB)
  return t === 'convert' || t === 'test' || t === 'minimize' ? t : 'define'
}

/**
 * Keeps positions for states that still exist and places new ones. With no
 * known positions the whole graph is laid out; otherwise new states are
 * stacked to the right of the existing drawing so nothing jumps.
 */
function placeNodes(nfa: ENFA, prev: Record<string, XY>): Record<string, XY> {
  const kept: Record<string, XY> = {}
  for (const s of nfa.states) if (prev[s]) kept[s] = prev[s]
  const missing = nfa.states.filter((s) => !kept[s])
  if (missing.length === 0) return kept
  if (Object.keys(kept).length === 0) return layoutLR(nfa.states, mergedEdges(nfa))
  const xs = Object.values(kept).map((p) => p.x)
  const ys = Object.values(kept).map((p) => p.y)
  const x = Math.max(...xs) + 120
  let y = Math.min(...ys)
  for (const s of missing) {
    kept[s] = { x, y }
    y += 90
  }
  return kept
}

const init = initialMachine()

export const useApp = create<AppState>((set, get) => ({
  nfa: init.nfa,
  presetId: init.presetId,
  origin: 'init',
  textDraft: toText(init.nfa),
  parseError: null,
  positions: placeNodes(init.nfa, {}),
  layoutNonce: 0,
  history: [],
  future: [],
  activeTab: initialTab(),
  editorView: 'table',
  focusRequest: null,
  hoverCell: null,
  ...derive(init.nfa),

  commit: (nfa, origin, opts = {}) => {
    const s = get()
    const fresh = origin === 'preset' || origin === 'new' || origin === 'import'
    const coalesce = origin === 'text' && s.origin === 'text'
    const history = coalesce
      ? s.history
      : [...s.history, { nfa: s.nfa, presetId: s.presetId, positions: s.positions }].slice(-HISTORY_LIMIT)
    let positions = s.positions
    if (opts.rename) {
      const [from, to] = opts.rename
      positions = { ...positions, [to]: positions[from] }
      delete positions[from]
    }
    set({
      nfa,
      origin,
      presetId: opts.presetId !== undefined ? opts.presetId : null,
      history,
      future: [],
      textDraft: origin === 'text' ? s.textDraft : toText(nfa),
      parseError: origin === 'text' ? s.parseError : null,
      positions: placeNodes(nfa, fresh ? {} : positions),
      layoutNonce: fresh ? s.layoutNonce + 1 : s.layoutNonce,
      ...derive(nfa),
    })
  },

  setTextDraft: (text) => {
    set({ textDraft: text })
    let parsed: ENFA
    try {
      parsed = parseText(text)
    } catch (e) {
      if (e instanceof ParseError) {
        set({ parseError: { line: e.line, message: e.message.replace(/^Line \d+: /, '') } })
        return
      }
      throw e
    }
    set({ parseError: null })
    if (toJSON(parsed) !== toJSON(get().nfa)) get().commit(parsed, 'text')
  },

  loadPreset: (id) => {
    const preset = getPreset(id)
    if (preset) get().commit(cloneENFA(preset.nfa), 'preset', { presetId: id })
  },

  undo: () => {
    const s = get()
    const prev = s.history.at(-1)
    if (!prev) return false
    set({
      nfa: prev.nfa,
      presetId: prev.presetId,
      positions: placeNodes(prev.nfa, prev.positions),
      history: s.history.slice(0, -1),
      future: [...s.future, { nfa: s.nfa, presetId: s.presetId, positions: s.positions }],
      origin: 'undo',
      textDraft: toText(prev.nfa),
      parseError: null,
      ...derive(prev.nfa),
    })
    return true
  },

  redo: () => {
    const s = get()
    const next = s.future.at(-1)
    if (!next) return false
    set({
      nfa: next.nfa,
      presetId: next.presetId,
      positions: placeNodes(next.nfa, next.positions),
      history: [...s.history, { nfa: s.nfa, presetId: s.presetId, positions: s.positions }].slice(-HISTORY_LIMIT),
      future: s.future.slice(0, -1),
      origin: 'redo',
      textDraft: toText(next.nfa),
      parseError: null,
      ...derive(next.nfa),
    })
    return true
  },

  setPosition: (id, xy) => set((s) => ({ positions: { ...s.positions, [id]: xy } })),
  relayout: () =>
    set((s) => ({ positions: layoutLR(s.nfa.states, mergedEdges(s.nfa)), layoutNonce: s.layoutNonce + 1 })),
  setActiveTab: (tab) => {
    writeStorage(KEY_TAB, tab)
    set({ activeTab: tab })
  },
  setEditorView: (view) => set({ editorView: view }),
  requestFocus: (target) =>
    set((s) => ({
      focusRequest: { target, nonce: (s.focusRequest?.nonce ?? 0) + 1 },
      // Text targets open the "Text format" section; other targets leave it as it is.
      editorView: target.kind === 'text' ? 'text' : s.editorView,
    })),
  setHoverCell: (cell) => set({ hoverCell: cell }),
}))

// Persist the machine whenever it changes. Failures are ignored (see writeStorage).
useApp.subscribe((s, prev) => {
  if (s.nfa !== prev.nfa) writeStorage(KEY_NFA, toJSON(s.nfa, 0))
  if (s.presetId !== prev.presetId) writeStorage(KEY_PRESET, s.presetId ?? '')
})
