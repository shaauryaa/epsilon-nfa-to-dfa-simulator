/**
 * Sentences for the PDF report that depend on the result: what it says about
 * the dead state, and the minimisation summary.
 */

import { formatSet, type DFA, type MinimizeResult } from '../core'

/**
 * Whether some state of a DFA has no move on some symbol (a partial DFA).
 *
 * @param dfa - The DFA.
 * @returns `true` if any (state, symbol) pair has no transition.
 * @throws Never throws.
 */
export function hasMissingMoves(dfa: DFA): boolean {
  return dfa.states.some((s) => dfa.alphabet.some((a) => dfa.transitions[s]?.[a] === undefined))
}

/**
 * The report's sentence about the dead state, matching the "Show dead
 * state ∅" toggle and whether any move actually leads to the empty set.
 *
 * @param dfa - The DFA as converted (with or without ∅, following the toggle).
 * @param showDead - The toggle's value when the report was made.
 * @returns One sentence.
 * @throws Never throws.
 */
export function deadStateNote(dfa: DFA, showDead: boolean): string {
  if (dfa.deadState) {
    return `${dfa.deadState} is the dead state: every move to the empty set goes there, it is non-final and loops to itself, so the DFA is complete.`
  }
  if (hasMissingMoves(dfa)) {
    return showDead
      ? 'Some moves have no target, so the DFA is partial and a missing move means reject.'
      : 'The dead state ∅ is hidden (the "Show dead state" switch is off), so the DFA is partial: a missing move means reject.'
  }
  return 'Every state has a move on every symbol, so no dead state is needed and the DFA is complete.'
}

/** What the report prints about minimisation. */
export interface MinimisationSummary {
  /** One-paragraph summary with the state counts. */
  text: string
  /** Groups of merged states (only groups with two or more members), as `{A,C} → A/C` lines. */
  merged: string[]
  /** States removed because they cannot be reached. */
  removed: string[]
}

/**
 * Summarises a minimisation: state counts before and after, the groups that
 * were merged, and unreachable states that were dropped.
 *
 * @param before - The DFA that was minimised.
 * @param result - The output of `minimizeDFA(before)`.
 * @returns The summary text and lists.
 * @throws Never throws.
 */
export function minimisationSummary(before: DFA, result: MinimizeResult): MinimisationSummary {
  const groups = new Map<string, string[]>()
  for (const [old, now] of Object.entries(result.mapping)) {
    if (!before.states.includes(old)) continue
    const list = groups.get(now) ?? []
    list.push(old)
    groups.set(now, list)
  }
  const order = new Map(before.states.map((s, i) => [s, i]))
  const merged = [...groups.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([now, g]) => `${formatSet(g.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)))} → ${now}`)
  const n = before.states.length
  const m = result.dfa.states.length
  const added = result.dfa.states.length > groups.size ? ' A dead state was added to make the DFA complete.' : ''
  const text =
    m < n
      ? `Partition refinement reduces the DFA from ${n} to ${m} state${m === 1 ? '' : 's'}.${added}`
      : m === n
        ? `The DFA is already minimal: all ${n} states are distinguishable.${added}`
        : `The minimal complete DFA has ${m} states (the converted DFA has ${n}).${added}`
  return { text, merged, removed: [...result.removedUnreachable] }
}
