/**
 * DFA minimisation by partition refinement (Moore's algorithm), recording
 * every round for step-by-step display.
 */

import { formatSet } from './sets'
import { DEAD_STATE } from './subset'
import type { DFA } from './types'

/** A group that split during one refinement round. */
export interface PartitionSplit {
  /** The group before the split. */
  group: string[]
  /** First symbol (alphabet order) on which members of `group` disagree. */
  symbol: string
  /** The resulting subgroups. */
  into: string[][]
}

/** One recorded step of {@link minimizeDFA}. */
export type MinimizeStep =
  | { kind: 'unreachable'; removed: string[]; explanation: string }
  | { kind: 'complete'; deadState: string | null; added: { from: string; symbol: string }[]; explanation: string }
  | { kind: 'partition'; round: number; partition: string[][]; splits: PartitionSplit[]; explanation: string }
  | { kind: 'done'; mapping: Record<string, string>; explanation: string }

/** Result of {@link minimizeDFA}. */
export interface MinimizeResult {
  /** The minimal complete DFA. */
  dfa: DFA
  steps: MinimizeStep[]
  /** States removed because the start state cannot reach them. */
  removedUnreachable: string[]
  /** Old state name → new state name, for every reachable state (and any added dead state). */
  mapping: Record<string, string>
}

/**
 * Builds the name of a merged state: the single old name for a singleton
 * group, otherwise the old names joined in set notation, e.g. `{A,C}`.
 *
 * @param group - Old state names in order.
 * @returns The new state name.
 * @throws Never throws.
 */
export function mergedName(group: readonly string[]): string {
  return group.length === 1 ? group[0] : formatSet(group)
}

/**
 * Minimises a DFA.
 *
 * Algorithm:
 * 1. Remove states unreachable from the start state (BFS over transitions).
 * 2. If the remaining DFA is partial, add a dead state (named after
 *    `dfa.deadState`, else `∅`, primed if that name is taken) and route every
 *    missing transition to it, making the DFA complete.
 * 3. Partition refinement: start from {F, Q−F} (empty blocks omitted). In
 *    each round, every group is split by the "signature" of its members —
 *    the tuple of groups their transitions lead to, one entry per symbol in
 *    alphabet order. All splits in a round use the previous round's
 *    partition. Stop when a round splits nothing.
 * 4. Each final group becomes one state named by {@link mergedName}.
 *
 * Groups are kept in the order of their first member in the (reachable)
 * state order, and members inside a group keep that order, so results are
 * deterministic. The result is the unique minimal complete DFA for the
 * language, up to renaming. Its `subsets` are the unions of the members'
 * subsets (in first-seen order), and `deadState` is the non-final state
 * whose every transition loops back to itself, if there is one.
 *
 * @param input - The DFA to minimise. It is not modified. Transitions to
 *   undeclared states are treated as missing.
 * @returns The minimal DFA, the step log, removed states and the name mapping.
 * @throws Never throws for a well-formed DFA.
 */
export function minimizeDFA(input: DFA): MinimizeResult {
  const steps: MinimizeStep[] = []
  const alphabet = input.alphabet
  const declared = new Set(input.states)

  // 1. Reachability.
  const reachable = new Set<string>([input.start])
  const queue = [input.start]
  for (let i = 0; i < queue.length; i++) {
    for (const sym of alphabet) {
      const t = input.transitions[queue[i]]?.[sym]
      if (t !== undefined && declared.has(t) && !reachable.has(t)) {
        reachable.add(t)
        queue.push(t)
      }
    }
  }
  const removedUnreachable = input.states.filter((s) => !reachable.has(s))
  const states = input.states.filter((s) => reachable.has(s))
  steps.push({
    kind: 'unreachable',
    removed: removedUnreachable,
    explanation:
      removedUnreachable.length === 0
        ? 'Every state is reachable from the start state; nothing to remove.'
        : `Removed unreachable state${removedUnreachable.length === 1 ? '' : 's'} ${removedUnreachable.join(', ')}.`,
  })

  // 2. Completion.
  const delta: Record<string, Record<string, string>> = {}
  const missing: { from: string; symbol: string }[] = []
  for (const s of states) {
    delta[s] = {}
    for (const sym of alphabet) {
      const t = input.transitions[s]?.[sym]
      if (t !== undefined && reachable.has(t)) delta[s][sym] = t
      else missing.push({ from: s, symbol: sym })
    }
  }
  let addedDead: string | null = null
  if (missing.length > 0) {
    let name = input.deadState ?? DEAD_STATE
    while (states.includes(name)) name += "'"
    addedDead = name
    states.push(name)
    delta[name] = {}
    for (const sym of alphabet) delta[name][sym] = name
    for (const m of missing) delta[m.from][m.symbol] = name
  }
  steps.push({
    kind: 'complete',
    deadState: addedDead,
    added: missing,
    explanation:
      addedDead === null
        ? 'The DFA is already complete.'
        : `The DFA is partial: added dead state ${addedDead} and ${missing.length} missing transition${
            missing.length === 1 ? '' : 's'
          } to it.`,
  })

  // 3. Partition refinement.
  const order = new Map(states.map((s, i) => [s, i]))
  const finalSet = new Set(input.finals.filter((f) => reachable.has(f)))
  const byFirstMember = (a: string[], b: string[]) => (order.get(a[0]) as number) - (order.get(b[0]) as number)
  let partition = [states.filter((s) => finalSet.has(s)), states.filter((s) => !finalSet.has(s))]
    .filter((g) => g.length > 0)
    .sort(byFirstMember)
  steps.push({
    kind: 'partition',
    round: 0,
    partition,
    splits: [],
    explanation: `Initial partition {F, Q−F}: ${partition.map(formatSet).join(' ')}.`,
  })

  for (let round = 1; ; round++) {
    const groupOf = new Map<string, number>()
    partition.forEach((g, i) => g.forEach((s) => groupOf.set(s, i)))
    const next: string[][] = []
    const splits: PartitionSplit[] = []
    for (const group of partition) {
      const bySig = new Map<string, string[]>()
      for (const s of group) {
        const sig = alphabet.map((sym) => groupOf.get(delta[s][sym])).join(',')
        const list = bySig.get(sig)
        if (list) list.push(s)
        else bySig.set(sig, [s])
      }
      const parts = [...bySig.values()]
      next.push(...parts)
      if (parts.length > 1) {
        const symbol =
          alphabet.find((sym) => new Set(group.map((s) => groupOf.get(delta[s][sym]))).size > 1) ?? alphabet[0]
        splits.push({ group, symbol, into: parts })
      }
    }
    next.sort(byFirstMember)
    if (splits.length === 0) break
    partition = next
    steps.push({
      kind: 'partition',
      round,
      partition,
      splits,
      explanation: `Round ${round}: ${splits
        .map((sp) => `${formatSet(sp.group)} splits on ${sp.symbol} into ${sp.into.map(formatSet).join(' ')}`)
        .join('; ')}.`,
    })
  }

  // 4. Build the minimal DFA.
  const mapping: Record<string, string> = {}
  for (const g of partition) for (const s of g) mapping[s] = mergedName(g)
  const dfa: DFA = {
    states: partition.map(mergedName),
    alphabet: [...alphabet],
    start: mapping[input.start],
    finals: partition.filter((g) => finalSet.has(g[0])).map(mergedName),
    transitions: {},
    subsets: {},
    deadState: null,
  }
  for (const g of partition) {
    const name = mergedName(g)
    dfa.transitions[name] = {}
    for (const sym of alphabet) dfa.transitions[name][sym] = mapping[delta[g[0]][sym]]
    dfa.subsets[name] = [...new Set(g.flatMap((s) => input.subsets?.[s] ?? []))]
    const isTrap = !finalSet.has(g[0]) && alphabet.every((sym) => dfa.transitions[name][sym] === name)
    if (isTrap && dfa.deadState === null) dfa.deadState = name
  }
  steps.push({
    kind: 'done',
    mapping,
    explanation: `The partition is stable. The minimal DFA has ${dfa.states.length} state${
      dfa.states.length === 1 ? '' : 's'
    } (was ${input.states.length}).`,
  })

  return { dfa, steps, removedUnreachable, mapping }
}
