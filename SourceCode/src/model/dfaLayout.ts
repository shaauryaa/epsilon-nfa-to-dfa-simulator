/**
 * Layout and captions for drawing a DFA produced by subset construction.
 */

import { dfaToENFA, formatSet, type DFA } from '../core'
import { layoutLR, type XY } from '../graph/layout'
import { mergedEdges } from './graph'

/** Spacing for DFA layouts: room for the subset caption under each state. */
export const DFA_SPACING = { nodesep: 80, ranksep: 96 }

/**
 * Lays out a whole DFA once, so states keep their place as they are
 * discovered one by one.
 *
 * @param dfa - The DFA.
 * @returns Top-left position of each state.
 * @throws Never throws.
 */
export function layoutDFA(dfa: DFA): Record<string, XY> {
  return layoutLR(dfa.states, mergedEdges(dfaToENFA(dfa)), DFA_SPACING)
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
