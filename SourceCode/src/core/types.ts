/**
 * Shared data types for the automata core.
 *
 * Everything here is plain data (JSON-serialisable records and arrays) so it
 * can be stored, diffed and passed between the core and any UI without
 * conversion.
 */

/** The symbol used as the transition key for ε (empty-string) moves. */
export const EPSILON = 'ε'

/**
 * An ε-NFA.
 *
 * - `states` and `alphabet` are ordered; that order is the "declaration order"
 *   used everywhere results must be deterministic.
 * - State names and symbols may be longer than one character but must not be
 *   blank or contain whitespace or commas (see `validateENFA`).
 * - `transitions[state][symbol]` lists target states. `symbol` is an alphabet
 *   symbol or {@link EPSILON}. Missing entries mean "no transition".
 */
export interface ENFA {
  states: string[]
  alphabet: string[]
  start: string
  finals: string[]
  transitions: Record<string, Record<string, string[]>>
}

/**
 * A deterministic finite automaton produced by subset construction or
 * minimisation.
 *
 * - `transitions[state][symbol]` is the single target state. A missing entry
 *   makes the DFA *partial*: reading that symbol in that state rejects.
 * - `subsets[state]` lists the NFA states the DFA state stands for, in NFA
 *   declaration order. The dead state maps to `[]`.
 * - `deadState` names the trap state (non-final, every symbol loops back to
 *   itself) when there is one, otherwise `null`.
 */
export interface DFA {
  states: string[]
  alphabet: string[]
  start: string
  finals: string[]
  transitions: Record<string, Record<string, string>>
  subsets: Record<string, string[]>
  deadState: string | null
}
