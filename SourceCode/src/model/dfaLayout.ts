/**
 * Layout and captions for drawing a DFA produced by subset construction.
 *
 * Each DFA state carries a caption (its NFA subset) under the circle. The
 * caption is part of the state's layout box, so dagre spaces states with
 * their captions, and its rectangle is passed to edge routing so no edge
 * line or edge label crosses it. The canvas, the SVG/PNG export and the PDF
 * picture all use the same geometry.
 */

import { dfaToENFA, formatSet, type DFA } from '../core'
import { layoutLR, NODE_SIZE, type XY } from '../graph/layout'
import type { Rect } from '../graph/routing'
import { mergedEdges } from './graph'
import { gridLayout, isTooLargeToDraw } from './largeDfa'

/** Spacing for DFA layouts. Captions are part of each node box, so the gaps can stay modest. */
export const DFA_SPACING = { nodesep: 28, ranksep: 48 }

/** Caption geometry, in px at zoom 1. */
export const CAPTION = {
  /** Gap between the circle and the caption box. */
  gap: 6,
  /** Height of the caption box. */
  height: 20,
  /** Font size of the caption text. */
  font: 13,
  /** Widest caption box; longer captions are truncated on the canvas. */
  maxWidth: 160,
} as const

/**
 * Width of the caption box for a caption text.
 *
 * @param text - The caption.
 * @returns Width in px, capped at {@link CAPTION}.maxWidth.
 * @throws Never throws.
 */
export function captionWidth(text: string): number {
  return Math.min(CAPTION.maxWidth, Math.ceil([...text].length * CAPTION.font * 0.62 + 10))
}

/**
 * The caption box under a state circle.
 *
 * @param centre - Centre of the state circle.
 * @param text - The caption.
 * @returns The box, centred under the circle.
 * @throws Never throws.
 */
export function captionRect(centre: XY, text: string): Rect {
  const width = captionWidth(text)
  return { x: centre.x - width / 2, y: centre.y + NODE_SIZE / 2 + CAPTION.gap, width, height: CAPTION.height }
}

/**
 * Caption boxes for every listed state that has a caption, from top-left
 * circle positions.
 *
 * @param positions - Top-left position of each circle.
 * @param captions - Caption per state.
 * @param states - The states to include (default: every captioned state).
 * @returns One box per captioned state that has a position.
 * @throws Never throws.
 */
export function captionRects(positions: Readonly<Record<string, XY>>, captions: Readonly<Record<string, string>>, states: readonly string[] = Object.keys(captions)): Rect[] {
  const out: Rect[] = []
  for (const s of states) {
    const p = positions[s]
    const text = captions[s]
    if (!p || !text) continue
    out.push(captionRect({ x: p.x + NODE_SIZE / 2, y: p.y + NODE_SIZE / 2 }, text))
  }
  return out
}

/**
 * Caption under a DFA state: its subset of NFA states, or "dead state".
 *
 * @param dfa - The DFA.
 * @param state - One of its states.
 * @returns The caption.
 * @throws Never throws.
 */
export function dfaCaption(dfa: DFA, state: string): string {
  return state === dfa.deadState ? 'dead state' : formatSet(dfa.subsets[state] ?? [])
}

/**
 * Caption of every DFA state.
 *
 * @param dfa - The DFA.
 * @returns Caption per state.
 * @throws Never throws.
 */
export function dfaCaptions(dfa: DFA): Record<string, string> {
  return Object.fromEntries(dfa.states.map((s) => [s, dfaCaption(dfa, s)]))
}

const layouts = new WeakMap<DFA, Record<string, XY>>()

/**
 * Lays out a whole DFA once, so states keep their place as they are
 * discovered one by one. Each node box is the circle plus its caption.
 *
 * DFAs larger than `MAX_DRAWN_DFA_STATES` are not laid out with dagre (it
 * is slow and can overflow the stack on thousands of states); they get a
 * plain grid, used only for exports such as JFLAP positions.
 *
 * @param dfa - The DFA.
 * @returns Top-left position of each state's circle. Cached per DFA object.
 * @throws Never throws.
 */
export function layoutDFA(dfa: DFA): Record<string, XY> {
  const hit = layouts.get(dfa)
  if (hit) return hit
  let out: Record<string, XY>
  if (isTooLargeToDraw(dfa.states.length)) out = gridLayout(dfa.states)
  else {
    const boxes = Object.fromEntries(
      dfa.states.map((s) => [s, { width: captionWidth(dfaCaption(dfa, s)) + 8, height: NODE_SIZE + CAPTION.gap + CAPTION.height + 4 }]),
    )
    out = layoutLR(dfa.states, mergedEdges(dfaToENFA(dfa)), DFA_SPACING, boxes)
  }
  layouts.set(dfa, out)
  return out
}
