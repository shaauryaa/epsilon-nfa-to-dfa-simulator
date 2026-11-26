/**
 * Subset (powerset) construction: converts an ε-NFA into an equivalent DFA,
 * recording every step for step-by-step display.
 */

import { assertValidENFA } from './automaton'
import { epsilonClosure, move } from './closure'
import { formatSet } from './sets'
import type { DFA, ENFA } from './types'

/** Name given to the DFA state for the empty set of NFA states. */
export const DEAD_STATE = '∅'

/** Options for {@link subsetConstruction}. */
export interface SubsetOptions {
  /**
   * When `true` (default) the empty set becomes an explicit dead state `∅`
   * and the DFA is complete. When `false` transitions to the empty set are
   * left undefined, producing a *partial* DFA in which a missing transition
   * means "reject".
   */
  includeDeadState?: boolean
}

/** One recorded step of subset construction. */
export interface SubsetStep {
  /** 0-based position in the step list. */
  index: number
  /** `start`: the initial state; `transition`: one (state, symbol) pair; `done`: the end. */
  kind: 'start' | 'transition' | 'done'
  /** DFA state being expanded (`transition` only). */
  from?: string
  /** NFA states of `from` (`transition` only). */
  fromSet?: string[]
  /** Symbol being processed (`transition` only). */
  symbol?: string
  /** move(fromSet, symbol), before ε-closure (`transition` only). */
  moveSet?: string[]
  /** The ε-closure computed in this step (empty for `done`). */
  closureSet: string[]
  /** Target DFA state, or `null` if there is none (partial DFA, or `done`). */
  to: string | null
  /** Whether `to` was created by this step. */
  isNew: boolean
  /** Human-readable sentence describing the step. */
  explanation: string
}

/** Size statistics for a run of {@link subsetConstruction}. */
export interface SubsetStats {
  nfaStates: number
  dfaStates: number
  /** 2^nfaStates, the theoretical maximum number of DFA states. */
  upperBound: number
  /** Wall-clock time spent, in milliseconds. */
  ms: number
}

/** Result of {@link subsetConstruction}. */
export interface SubsetResult {
  dfa: DFA
  steps: SubsetStep[]
  stats: SubsetStats
}

/**
 * Returns the DFA state name for a 0-based discovery index:
 * A, B, …, Z, then A1, B1, …, Z1, then A2, ….
 *
 * @param index - Non-negative integer.
 * @returns The state name.
 * @throws {RangeError} If `index` is negative or not an integer.
 */
export function dfaStateName(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new RangeError(`Invalid state index ${index}`)
  const letter = String.fromCharCode(65 + (index % 26))
  const round = Math.floor(index / 26)
  return round === 0 ? letter : `${letter}${round}`
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Converts an ε-NFA to a DFA by subset construction.
 *
 * Algorithm:
 * 1. The start DFA state is ε-closure({start}).
 * 2. Unmarked DFA states are processed in discovery (BFS / queue) order, and
 *    for each one the symbols are processed in declared alphabet order, so the
 *    output (names, order, steps) is fully deterministic.
 * 3. For state T and symbol a, U = ε-closure(move(T, a)). If U has not been
 *    seen it becomes a new DFA state named by {@link dfaStateName}.
 * 4. The empty set becomes the dead state `∅` (not counted in the letter
 *    sequence) when `includeDeadState` is true; otherwise the transition is
 *    left undefined and the result is a partial DFA.
 * 5. A DFA state is final iff its subset contains at least one NFA final state.
 *
 * Only reachable subsets are built, so the DFA has at most 2^n states (n =
 * NFA states) and usually far fewer. NFA subsets are compared as sorted
 * (declaration-order) lists.
 *
 * @param nfa - A valid ε-NFA (see `validateENFA`).
 * @param options - See {@link SubsetOptions}.
 * @returns The DFA, the step log, and size/time statistics.
 * @throws {InvalidAutomatonError} If the ε-NFA has validation errors.
 */
export function subsetConstruction(nfa: ENFA, options: SubsetOptions = {}): SubsetResult {
  const t0 = now()
  const includeDeadState = options.includeDeadState ?? true
  assertValidENFA(nfa)

  const finalSet = new Set(nfa.finals)
  const nameOf = new Map<string, string>()
  const dfa: DFA = {
    states: [],
    alphabet: [...nfa.alphabet],
    start: '',
    finals: [],
    transitions: {},
    subsets: {},
    deadState: null,
  }
  const steps: SubsetStep[] = []
  const queue: string[] = []
  let letters = 0

  const addState = (subset: string[]): string => {
    const name = subset.length === 0 ? DEAD_STATE : dfaStateName(letters++)
    nameOf.set(subset.join(','), name)
    dfa.states.push(name)
    dfa.subsets[name] = subset
    dfa.transitions[name] = {}
    if (subset.length === 0) dfa.deadState = name
    if (subset.some((s) => finalSet.has(s))) dfa.finals.push(name)
    queue.push(name)
    return name
  }

  const startSet = epsilonClosure(nfa, [nfa.start])
  dfa.start = addState(startSet)
  steps.push({
    index: 0,
    kind: 'start',
    closureSet: startSet,
    to: dfa.start,
    isNew: true,
    explanation: `Start state ${dfa.start} = ε-closure({${nfa.start}}) = ${formatSet(startSet)}${
      dfa.finals.includes(dfa.start) ? ', which is final' : ''
    }.`,
  })

  for (let qi = 0; qi < queue.length; qi++) {
    const from = queue[qi]
    const fromSet = dfa.subsets[from]
    for (const symbol of nfa.alphabet) {
      const moveSet = move(nfa, fromSet, symbol)
      const closureSet = epsilonClosure(nfa, moveSet)
      const prefix = `From ${from} = ${formatSet(fromSet)} on ${symbol}: move = ${formatSet(moveSet)}, ε-closure = ${formatSet(closureSet)}`
      const base = { index: steps.length, kind: 'transition' as const, from, fromSet, symbol, moveSet, closureSet }

      if (closureSet.length === 0 && !includeDeadState) {
        steps.push({ ...base, to: null, isNew: false, explanation: `${prefix}; no transition (partial DFA).` })
        continue
      }
      const existing = nameOf.get(closureSet.join(','))
      const to = existing ?? addState(closureSet)
      dfa.transitions[from][symbol] = to
      const isFinal = dfa.finals.includes(to)
      let what: string
      if (existing !== undefined) what = `the existing state ${to}`
      else if (to === DEAD_STATE) what = `a new dead state ${to}`
      else what = `a new ${isFinal ? 'final ' : ''}state ${to}`
      steps.push({ ...base, to, isNew: existing === undefined, explanation: `${prefix}, ${what}.` })
    }
  }

  steps.push({
    index: steps.length,
    kind: 'done',
    closureSet: [],
    to: null,
    isNew: false,
    explanation: `No unmarked states remain. The DFA has ${dfa.states.length} state${
      dfa.states.length === 1 ? '' : 's'
    } (${dfa.finals.length} final)${includeDeadState ? '' : ' and may be partial'}.`,
  })

  return {
    dfa,
    steps,
    stats: { nfaStates: nfa.states.length, dfaStates: dfa.states.length, upperBound: 2 ** nfa.states.length, ms: now() - t0 },
  }
}
