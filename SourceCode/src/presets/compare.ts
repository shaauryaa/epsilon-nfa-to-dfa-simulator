/**
 * Helpers for comparing a generated DFA with a hand-derived expected table
 * (see `Preset.expectedDfaTable`).
 */

import type { DFA } from '../core/types'
import type { ExpectedDfaRow } from './index'

/**
 * Reads a DFA as table rows in its own state order (discovery order for
 * subset construction), in the same shape as an expected table.
 *
 * @param dfa - The DFA.
 * @returns One row per state; missing moves are left out of `on`.
 * @throws Never throws.
 */
export function dfaTableRows(dfa: DFA): ExpectedDfaRow[] {
  const finals = new Set(dfa.finals)
  return dfa.states.map((s) => {
    const on: Record<string, string> = {}
    for (const a of dfa.alphabet) {
      const t = dfa.transitions[s]?.[a]
      if (t !== undefined) on[a] = t
    }
    return { state: s, subset: [...(dfa.subsets[s] ?? [])], final: finals.has(s), on }
  })
}

/**
 * Writes table rows on one line for reports, e.g.
 * `→A{0,1,2,4,7}: a→B b→C; B{…}: …; *E{…}: …`.
 *
 * @param rows - Rows in order; the first is the start state.
 * @param alphabet - Symbol order for each row's moves.
 * @returns The compact text; equal tables give equal text.
 * @throws Never throws.
 */
export function formatDfaRows(rows: readonly ExpectedDfaRow[], alphabet: readonly string[]): string {
  return rows
    .map((r, i) => {
      const mark = `${i === 0 ? '→' : ''}${r.final ? '*' : ''}`
      const set = r.state === '∅' ? '' : `{${r.subset.join(',')}}`
      const moves = alphabet.map((a) => `${a}→${r.on[a] ?? '—'}`).join(' ')
      return `${mark}${r.state}${set}: ${moves}`
    })
    .join('; ')
}
