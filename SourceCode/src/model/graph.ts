/**
 * Turns an ε-NFA's transition table into drawable graph edges.
 */

import { EPSILON, type ENFA } from '../core'

/** One drawn edge: every transition between the same ordered pair of states. */
export interface MergedEdge {
  id: string
  source: string
  target: string
  /** Symbols on this edge, alphabet order first, ε last. */
  symbols: string[]
  /** Label shown on the edge, e.g. `a, b` or `ε`. */
  label: string
  /** True when every symbol on the edge is ε (drawn dashed). */
  epsilonOnly: boolean
  /** True for a self-loop. */
  loop: boolean
  /** True when an edge in the opposite direction also exists. */
  hasReverse: boolean
}

/** One transition `from --symbol--> to`. */
export interface TransitionTriple {
  from: string
  symbol: string
  to: string
}

/**
 * Lists every transition as a single triple, ordered by source state
 * (declaration order), then symbol (alphabet order, ε last), then target as
 * stored. Sources or symbols that are not declared come after, in storage
 * order, so nothing in the table is hidden from the list.
 *
 * @param nfa - The automaton.
 * @returns The transitions.
 * @throws Never throws.
 */
export function listTransitions(nfa: ENFA): TransitionTriple[] {
  const sources = [...nfa.states, ...Object.keys(nfa.transitions).filter((s) => !nfa.states.includes(s))]
  const symbolOrder = [...nfa.alphabet, EPSILON]
  const out: TransitionTriple[] = []
  for (const from of [...new Set(sources)]) {
    const row = nfa.transitions[from]
    if (!row) continue
    const symbols = [...symbolOrder.filter((s) => s in row), ...Object.keys(row).filter((s) => !symbolOrder.includes(s))]
    for (const symbol of symbols) for (const to of row[symbol] ?? []) out.push({ from, symbol, to })
  }
  return out
}

/**
 * Merges parallel transitions into one edge per (source, target) pair.
 *
 * Only transitions between declared states are drawn; the validator reports
 * the rest. Edges are ordered by source, then target, in declaration order.
 *
 * @param nfa - The automaton.
 * @returns The merged edges.
 * @throws Never throws.
 */
export function mergedEdges(nfa: ENFA): MergedEdge[] {
  const declared = new Set(nfa.states)
  const order = new Map(nfa.states.map((s, i) => [s, i]))
  const symbolOrder = [...nfa.alphabet, EPSILON]
  const pairs = new Map<string, { source: string; target: string; symbols: Set<string> }>()

  for (const source of nfa.states) {
    const row = nfa.transitions[source]
    if (!row) continue
    const symbols = [...symbolOrder.filter((s) => s in row), ...Object.keys(row).filter((s) => !symbolOrder.includes(s))]
    for (const sym of symbols) {
      for (const target of row[sym] ?? []) {
        if (!declared.has(target)) continue
        const key = `${source}\u0000${target}`
        const entry = pairs.get(key) ?? { source, target, symbols: new Set<string>() }
        entry.symbols.add(sym)
        pairs.set(key, entry)
      }
    }
  }

  const edges = [...pairs.values()].map(({ source, target, symbols }) => {
    const list = [...symbols]
    return {
      id: `e:${source}->${target}`,
      source,
      target,
      symbols: list,
      label: list.join(', '),
      epsilonOnly: list.every((s) => s === EPSILON),
      loop: source === target,
      hasReverse: source !== target && pairs.has(`${target}\u0000${source}`),
    }
  })
  return edges.sort(
    (a, b) => (order.get(a.source) ?? 0) - (order.get(b.source) ?? 0) || (order.get(a.target) ?? 0) - (order.get(b.target) ?? 0),
  )
}
