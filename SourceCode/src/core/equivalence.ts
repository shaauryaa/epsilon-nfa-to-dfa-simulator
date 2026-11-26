/**
 * Bounded (brute-force) language equivalence checking between automata.
 */

import { simulateDFA, simulateENFA } from './simulate'
import type { DFA, ENFA } from './types'

/** Either kind of automaton accepted by {@link checkEquivalence}. */
export type Automaton = ENFA | DFA

/** A string on which two automata disagree. */
export interface Counterexample {
  /** The string as a symbol sequence (`[]` is ε). */
  tokens: string[]
  /** The symbols concatenated for display (space-separated if any symbol is multi-character). */
  input: string
  acceptedByA: boolean
  acceptedByB: boolean
}

/** Result of {@link checkEquivalence}. */
export interface EquivalenceResult {
  /** `true` if no disagreement was found among the strings tested. */
  agree: boolean
  /** Number of strings tested. */
  tested: number
  /** `true` if every string up to `maxLen` was tested (the cap was not hit). */
  exhaustive: boolean
  /** The first (shortest, then alphabet-order) disagreement, if any. */
  counterexample?: Counterexample
}

/**
 * Enumerates every string over `alphabet` of length 0 to `maxLen`, as symbol
 * sequences.
 *
 * Order: by length, then lexicographically by alphabet position (so `[]`
 * comes first). There are Σ_{k=0..maxLen} |Σ|^k strings in total.
 *
 * @param alphabet - Symbols in the order to use; duplicates are not removed.
 * @param maxLen - Maximum length (in symbols). Negative values yield nothing.
 * @returns A generator of fresh arrays.
 * @throws Never throws.
 */
export function* allStrings(alphabet: readonly string[], maxLen: number): Generator<string[]> {
  for (let len = 0; len <= maxLen; len++) {
    if (len > 0 && alphabet.length === 0) return
    const idx = new Array<number>(len).fill(0)
    for (;;) {
      yield idx.map((i) => alphabet[i])
      let p = len - 1
      while (p >= 0 && idx[p] === alphabet.length - 1) idx[p--] = 0
      if (p < 0) break
      idx[p]++
    }
  }
}

/**
 * Tells whether an automaton is a DFA (single-target transitions) rather
 * than an ε-NFA.
 *
 * @param m - Either kind of automaton.
 * @returns `true` for a DFA. Detected by the presence of `subsets` or, failing
 *   that, by finding a string-valued transition.
 * @throws Never throws.
 */
export function isDFA(m: Automaton): m is DFA {
  if ('subsets' in m) return true
  for (const row of Object.values(m.transitions)) {
    for (const v of Object.values(row)) return typeof v === 'string'
  }
  return false
}

/**
 * Decides whether an automaton accepts a symbol sequence.
 *
 * @param m - An ε-NFA or DFA.
 * @param tokens - The input symbols.
 * @returns `true` if accepted.
 * @throws Never throws.
 */
export function accepts(m: Automaton, tokens: readonly string[]): boolean {
  return isDFA(m) ? simulateDFA(m, tokens).accepted : simulateENFA(m, tokens).accepted
}

/**
 * Checks whether two automata accept the same strings, up to a length bound.
 *
 * This is a bounded test, not a proof: it runs both machines on every string
 * over the union of their alphabets (A's order, then B's extra symbols) of
 * length ≤ `maxLen`, shortest first, stopping at the first disagreement or
 * after `cap` strings. Symbols outside one machine's alphabet simply have no
 * transitions there.
 *
 * @param a - First automaton (ε-NFA or DFA).
 * @param b - Second automaton (ε-NFA or DFA).
 * @param maxLen - Longest string length to test (default 8).
 * @param cap - Maximum number of strings to test (default 100000).
 * @returns Whether they agreed, how many strings were tested, whether the
 *   search was exhaustive, and the first counterexample if one was found.
 * @throws Never throws.
 */
export function checkEquivalence(a: Automaton, b: Automaton, maxLen = 8, cap = 100000): EquivalenceResult {
  const alphabet = [...a.alphabet, ...b.alphabet.filter((s) => !a.alphabet.includes(s))]
  const singleChar = alphabet.every((s) => [...s].length === 1)
  let tested = 0
  for (const tokens of allStrings(alphabet, maxLen)) {
    if (tested >= cap) return { agree: true, tested, exhaustive: false }
    tested++
    const acceptedByA = accepts(a, tokens)
    const acceptedByB = accepts(b, tokens)
    if (acceptedByA !== acceptedByB) {
      return {
        agree: false,
        tested,
        exhaustive: false,
        counterexample: { tokens, input: tokens.join(singleChar ? '' : ' '), acceptedByA, acceptedByB },
      }
    }
  }
  return { agree: true, tested, exhaustive: true }
}
