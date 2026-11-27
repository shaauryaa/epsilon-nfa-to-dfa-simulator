/**
 * Limits for drawing a DFA. Past {@link MAX_DRAWN_DFA_STATES} states the
 * Convert tab shows the tables and stats only: no graph layout, no routed
 * edges and no per-step animation, so a 2ⁿ blow-up stays responsive.
 */

import type { XY } from '../graph/layout'

/** Largest DFA that is drawn and animated. Bigger DFAs get the table view. */
export const MAX_DRAWN_DFA_STATES = 60

/** Rows per page of the DFA table in the large-DFA view. */
export const LARGE_TABLE_PAGE = 100

/**
 * Whether a DFA is too large to draw and animate.
 *
 * @param dfaStates - Number of DFA states, including ∅.
 * @returns `true` when the count exceeds {@link MAX_DRAWN_DFA_STATES}.
 * @throws Never throws.
 */
export function isTooLargeToDraw(dfaStates: number): boolean {
  return dfaStates > MAX_DRAWN_DFA_STATES
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/**
 * Writes a non-negative integer in superscript digits, e.g. `12` → `¹²`.
 *
 * @param n - A non-negative integer.
 * @returns The superscript string.
 * @throws Never throws.
 */
export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)] ?? d)
    .join('')
}

/**
 * The calm one-line notice shown instead of the DFA diagram.
 *
 * When the state count (ignoring ∅) is an exact power of two it is named as
 * the 2ⁿ worst case, since that is the classic subset-construction blow-up.
 *
 * @param dfaStates - Number of DFA states, including ∅.
 * @param hasDead - Whether one of them is the dead state ∅.
 * @returns E.g. "1024 states: the 2ⁿ worst case (2¹⁰). The diagram and step
 *   animation are hidden; the table is complete."
 * @throws Never throws.
 */
export function largeDfaNotice(dfaStates: number, hasDead = false): string {
  const live = hasDead ? dfaStates - 1 : dfaStates
  const pow = live > 0 && (live & (live - 1)) === 0 ? Math.log2(live) : -1
  const head =
    pow >= 0
      ? `${dfaStates} states: the 2ⁿ worst case (2${superscript(pow)}${hasDead ? ' + ∅' : ''})`
      : `${dfaStates} states: more than ${MAX_DRAWN_DFA_STATES} can be drawn clearly`
  return `${head}. The diagram and step animation are hidden; the table is complete.`
}

/**
 * Places states on a plain grid without running a graph layout. Used for
 * exports (JFLAP positions) of DFAs too large to lay out.
 *
 * @param states - State names in order.
 * @param columns - States per row (default 16).
 * @param gap - Distance between neighbouring states, in px (default 110).
 * @returns Top-left position of each state.
 * @throws Never throws.
 */
export function gridLayout(states: readonly string[], columns = 16, gap = 110): Record<string, XY> {
  const out: Record<string, XY> = {}
  states.forEach((s, i) => {
    out[s] = { x: 16 + (i % columns) * gap, y: 16 + Math.floor(i / columns) * gap }
  })
  return out
}

/**
 * Cuts a list into one page.
 *
 * @param items - The full list.
 * @param page - 0-based page number; clamped into range.
 * @param size - Items per page (default {@link LARGE_TABLE_PAGE}).
 * @returns The page's items, the clamped page number and the page count.
 * @throws Never throws.
 */
export function pageOf<T>(items: readonly T[], page: number, size = LARGE_TABLE_PAGE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const p = Math.min(Math.max(0, Math.floor(page)), pages - 1)
  return { items: items.slice(p * size, p * size + size), page: p, pages }
}
