/**
 * ε-closure and move, the two building blocks of subset construction and
 * ε-NFA simulation.
 */

import { indexOrder, sortByOrder } from './sets'
import { EPSILON, type ENFA } from './types'

/** δ(state, symbol) from own properties only, so names like "constructor" never hit inherited values. */
function ownTargets(nfa: ENFA, state: string, symbol: string): readonly string[] {
  const row = Object.hasOwn(nfa.transitions, state) ? nfa.transitions[state] : undefined
  return row && Object.hasOwn(row, symbol) ? row[symbol] : []
}

/** Result of {@link epsilonClosureTrace}. */
export interface ClosureTrace {
  /** The ε-closure, in declaration order. */
  closure: string[]
  /** Every ε-edge `[from, to]` examined, in the order the search followed it. */
  edges: [string, string][]
}

/**
 * Computes the ε-closure of a set of states and records the ε-edges used.
 *
 * Algorithm: iterative depth-first search with an explicit stack and a
 * visited set. Each state is pushed at most once, so the search terminates
 * even when ε-edges form cycles, and runs in O(V + E_ε).
 *
 * Every ε-edge leaving a state in the closure is reported exactly once in
 * `edges` (including edges to already-visited states, so a UI can highlight
 * cycles). Edge order follows the search: start states in the order given,
 * targets in the order they appear in the transition list.
 *
 * @param nfa - The automaton. Undeclared states are tolerated and sorted last.
 * @param states - The starting set; duplicates are ignored.
 * @returns The closure (sorted by declaration order) and the edges followed.
 * @throws Never throws.
 */
export function epsilonClosureTrace(nfa: ENFA, states: Iterable<string>): ClosureTrace {
  const visited = new Set<string>()
  const edges: [string, string][] = []
  const pending: string[] = []
  for (const s of states) {
    if (!visited.has(s)) {
      visited.add(s)
      pending.push(s)
    }
  }
  // The stack pops from the end; reverse so the first given state is expanded first.
  pending.reverse()
  while (pending.length > 0) {
    const s = pending.pop() as string
    const targets = ownTargets(nfa, s, EPSILON)
    const fresh: string[] = []
    for (const t of targets) {
      edges.push([s, t])
      if (!visited.has(t)) {
        visited.add(t)
        fresh.push(t)
      }
    }
    for (let i = fresh.length - 1; i >= 0; i--) pending.push(fresh[i])
  }
  return { closure: sortByOrder(indexOrder(nfa.states), visited), edges }
}

/**
 * Computes the ε-closure of a set of states: every state reachable from the
 * set using only ε-transitions (including the states themselves).
 *
 * Algorithm: iterative stack-based DFS with a visited set (see
 * {@link epsilonClosureTrace}); terminates on ε-cycles.
 *
 * @param nfa - The automaton.
 * @param states - The starting set; duplicates are ignored. An empty set
 *   gives an empty closure.
 * @returns The closure, without duplicates, sorted by declaration order.
 * @throws Never throws.
 */
export function epsilonClosure(nfa: ENFA, states: Iterable<string>): string[] {
  return epsilonClosureTrace(nfa, states).closure
}

/**
 * Computes move(T, a): the states reachable from any state in `states` by
 * exactly one transition on `symbol` (no ε-closure is applied).
 *
 * @param nfa - The automaton.
 * @param states - The source set.
 * @param symbol - An alphabet symbol. Passing {@link EPSILON} returns one
 *   ε-step, which is rarely what callers want.
 * @returns The target states, without duplicates, in declaration order.
 * @throws Never throws.
 */
export function move(nfa: ENFA, states: Iterable<string>, symbol: string): string[] {
  const out: string[] = []
  for (const s of states) {
    for (const t of ownTargets(nfa, s, symbol)) out.push(t)
  }
  return sortByOrder(indexOrder(nfa.states), out)
}

/**
 * Computes the ε-closure of every declared state on its own.
 *
 * @param nfa - The automaton.
 * @returns A record mapping each state to its ε-closure in declaration order.
 *   Keys follow declaration order.
 * @throws Never throws.
 */
export function closureTable(nfa: ENFA): Record<string, string[]> {
  const table: Record<string, string[]> = {}
  for (const s of nfa.states) table[s] = epsilonClosure(nfa, [s])
  return table
}
