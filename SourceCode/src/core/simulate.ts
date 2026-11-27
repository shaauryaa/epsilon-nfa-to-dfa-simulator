/**
 * Input tokenisation and step-by-step simulation of ε-NFAs and DFAs.
 */

import { epsilonClosure, move } from './closure'
import { formatSet } from './sets'
import { EPSILON, type DFA, type ENFA } from './types'

/** Thrown by {@link tokenize} when the input contains something outside the alphabet. */
export class InputSymbolError extends Error {
  /** 0-based index (in UTF-16 code units) of the first bad character. */
  readonly position: number
  /** The bad character. */
  readonly character: string
  constructor(position: number, character: string) {
    super(`"${character}" at position ${position} is not in the alphabet.`)
    this.name = 'InputSymbolError'
    this.position = position
    this.character = character
  }
}

/**
 * Splits an input string into alphabet symbols.
 *
 * - If every symbol is a single character, the input is split into
 *   characters (Unicode code points).
 * - Otherwise symbols are matched greedily, longest first, from left to right
 *   (maximal munch). Greedy matching is not backtracking: with alphabet
 *   {a, ab, bc} the input `abc` fails even though `a bc` would work.
 * - Whitespace between symbols is ignored (symbols never contain whitespace).
 * - The empty (or all-whitespace) string is ε and gives `[]`. So is a lone
 *   `ε` (ε can never be an alphabet symbol), so users may type ε to mean the
 *   empty string.
 *
 * @param input - The string to split.
 * @param alphabet - The declared symbols.
 * @returns The symbol sequence.
 * @throws {InputSymbolError} With the position and character of the first
 *   piece of input that does not start any alphabet symbol.
 */
export function tokenize(input: string, alphabet: readonly string[]): string[] {
  if (input.trim() === EPSILON) return []
  const tokens: string[] = []
  const symbols = new Set(alphabet)
  const singleChar = alphabet.every((s) => [...s].length === 1)

  if (singleChar) {
    let pos = 0
    for (const ch of input) {
      if (!/\s/.test(ch)) {
        if (!symbols.has(ch)) throw new InputSymbolError(pos, ch)
        tokens.push(ch)
      }
      pos += ch.length
    }
    return tokens
  }

  const bySize = [...symbols].sort((a, b) => b.length - a.length)
  let pos = 0
  while (pos < input.length) {
    if (/\s/.test(input[pos])) {
      pos++
      continue
    }
    const match = bySize.find((s) => input.startsWith(s, pos))
    if (match === undefined) {
      const cp = input.codePointAt(pos) as number
      throw new InputSymbolError(pos, String.fromCodePoint(cp))
    }
    tokens.push(match)
    pos += match.length
  }
  return tokens
}

/** One symbol read during {@link simulateENFA}. */
export interface ENFAStep {
  symbol: string
  /** Current set before reading the symbol. */
  before: string[]
  /** move(before, symbol). */
  moved: string[]
  /** ε-closure(moved): the new current set. */
  after: string[]
}

/** Result of {@link simulateENFA}. */
export interface ENFASimulation {
  accepted: boolean
  /** ε-closure of the start state, the set before any input is read. */
  initial: string[]
  steps: ENFAStep[]
  /** The set after the whole input. */
  final: string[]
}

/**
 * Runs an ε-NFA on a token sequence, tracking the set of current states.
 *
 * Algorithm: start from ε-closure({start}); for each symbol a, the new set is
 * ε-closure(move(current, a)). Once the set is empty it stays empty (the run
 * is dead) but steps are still recorded. The input is accepted iff the final
 * set contains a final state.
 *
 * @param nfa - The automaton (assumed valid).
 * @param tokens - Symbols, e.g. from {@link tokenize}. `[]` is ε.
 * @returns Acceptance, the initial and final sets, and one step per symbol.
 * @throws Never throws.
 */
export function simulateENFA(nfa: ENFA, tokens: readonly string[]): ENFASimulation {
  const initial = epsilonClosure(nfa, [nfa.start])
  let current = initial
  const steps: ENFAStep[] = []
  for (const symbol of tokens) {
    const moved = move(nfa, current, symbol)
    const after = epsilonClosure(nfa, moved)
    steps.push({ symbol, before: current, moved, after })
    current = after
  }
  const finals = new Set(nfa.finals)
  return { accepted: current.some((s) => finals.has(s)), initial, steps, final: current }
}

/** One symbol read during {@link simulateDFA}. */
export interface DFAStep {
  symbol: string
  from: string
  /** Target state, or `null` if the (partial) DFA has no transition. */
  to: string | null
  explanation: string
}

/** Result of {@link simulateDFA}. */
export interface DFASimulation {
  accepted: boolean
  /** States visited, starting with the start state. Stops early on a missing transition. */
  path: string[]
  steps: DFAStep[]
}

/**
 * Runs a DFA on a token sequence.
 *
 * Follows one transition per symbol from the start state. If the DFA is
 * partial and a transition is missing, the run stops there and rejects; the
 * last step has `to: null` and says why. Otherwise the input is accepted iff
 * the last state is final.
 *
 * @param dfa - The DFA.
 * @param tokens - Symbols, e.g. from {@link tokenize}. `[]` is ε.
 * @returns Acceptance, the path of visited states, and one step per symbol read.
 * @throws Never throws.
 */
export function simulateDFA(dfa: DFA, tokens: readonly string[]): DFASimulation {
  const finals = new Set(dfa.finals)
  let current = dfa.start
  const path = [current]
  const steps: DFAStep[] = []
  for (const symbol of tokens) {
    // Own properties only: a symbol such as "constructor" must not find an inherited value.
    const row = Object.hasOwn(dfa.transitions, current) ? dfa.transitions[current] : undefined
    const to = row && Object.hasOwn(row, symbol) ? row[symbol] : undefined
    if (to === undefined) {
      steps.push({
        symbol,
        from: current,
        to: null,
        explanation: `No transition from ${current} on ${symbol}: the input is rejected (partial DFA).`,
      })
      return { accepted: false, path, steps }
    }
    const sub = dfa.subsets && Object.hasOwn(dfa.subsets, to) ? dfa.subsets[to] : undefined
    steps.push({
      symbol,
      from: current,
      to,
      explanation: `${current} --${symbol}--> ${to}${sub ? ` ${formatSet(sub)}` : ''}${finals.has(to) ? ' (final)' : ''}.`,
    })
    current = to
    path.push(to)
  }
  return { accepted: finals.has(current), path, steps }
}
