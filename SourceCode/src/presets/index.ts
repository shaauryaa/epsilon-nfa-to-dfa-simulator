/**
 * Example automata, each with strings it must accept and reject.
 *
 * Inputs in `expected` are raw strings as a user would type them; they are
 * split with `tokenize`. The empty string is ε.
 */

import { EPSILON, type ENFA } from '../core/types'

/**
 * One row of a hand-derived (textbook) DFA table: the DFA state's name, the
 * NFA subset it stands for, whether it is final, and its move on each
 * symbol. `∅` is the dead state.
 */
export interface ExpectedDfaRow {
  state: string
  subset: string[]
  final: boolean
  on: Record<string, string>
}

/** A ready-made example machine. */
export interface Preset {
  id: string
  name: string
  /** Short title for the quick-access chips in the navbar. */
  shortName?: string
  description: string
  nfa: ENFA
  expected: { accepts: string[]; rejects: string[] }
  /** Number of DFA states from subset construction (with the dead state). */
  expectedDfaStates?: number
  /**
   * The DFA table worked out by hand (with the dead state), in discovery
   * order; the first row is the start state. Given where a textbook answer
   * exists, so the generated table can be compared with it row by row.
   */
  expectedDfaTable?: ExpectedDfaRow[]
  /** Number of states of the minimal complete DFA, worked out by hand (Myhill–Nerode classes). */
  expectedMinStates?: number
}

const E = EPSILON

export const presets: Preset[] = [
  {
    id: 'thompson-abb',
    name: 'Thompson ε-NFA for (a|b)*abb',
    shortName: '(a|b)*abb',
    description:
      'The textbook Thompson construction for (a|b)*abb with states 0–10. Subset construction gives the five DFA states A–E.',
    nfa: {
      states: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      alphabet: ['a', 'b'],
      start: '0',
      finals: ['10'],
      transitions: {
        '0': { [E]: ['1', '7'] },
        '1': { [E]: ['2', '4'] },
        '2': { a: ['3'] },
        '3': { [E]: ['6'] },
        '4': { b: ['5'] },
        '5': { [E]: ['6'] },
        '6': { [E]: ['1', '7'] },
        '7': { a: ['8'] },
        '8': { b: ['9'] },
        '9': { b: ['10'] },
      },
    },
    expected: {
      accepts: ['abb', 'aabb', 'babb', 'ababb', 'bbabb', 'abbabb'],
      rejects: ['', 'a', 'b', 'ab', 'abba', 'bab', 'abab', 'bbbb'],
    },
    expectedDfaStates: 5,
    // Aho, Lam, Sethi, Ullman, Compilers (2nd ed.), Fig. 3.35.
    expectedDfaTable: [
      { state: 'A', subset: ['0', '1', '2', '4', '7'], final: false, on: { a: 'B', b: 'C' } },
      { state: 'B', subset: ['1', '2', '3', '4', '6', '7', '8'], final: false, on: { a: 'B', b: 'D' } },
      { state: 'C', subset: ['1', '2', '4', '5', '6', '7'], final: false, on: { a: 'B', b: 'C' } },
      { state: 'D', subset: ['1', '2', '4', '5', '6', '7', '9'], final: false, on: { a: 'B', b: 'E' } },
      { state: 'E', subset: ['1', '2', '4', '5', '6', '7', '10'], final: true, on: { a: 'B', b: 'C' } },
    ],
    // {A, C} merge (both mean "no progress towards abb"), giving A/C, B, D, E.
    expectedMinStates: 4,
  },
  {
    id: 'a-star-b-star-c-star',
    name: 'a*b*c* with an ε chain',
    shortName: 'a*b*c*',
    description: 'q0 loops on a, q1 on b, q2 on c, joined by q0 ε→ q1 ε→ q2. The final state q2 is ε-reachable from every state.',
    nfa: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b', 'c'],
      start: 'q0',
      finals: ['q2'],
      transitions: {
        q0: { a: ['q0'], [E]: ['q1'] },
        q1: { b: ['q1'], [E]: ['q2'] },
        q2: { c: ['q2'] },
      },
    },
    expected: {
      accepts: ['', 'a', 'b', 'c', 'abc', 'aabbcc', 'ac', 'bc', 'aaa', 'ccc'],
      rejects: ['ba', 'cb', 'ca', 'abca', 'acb', 'cba'],
    },
    expectedDfaStates: 4,
    // Still reading a's, b's, c's, or dead: each pair is told apart by one symbol.
    expectedMinStates: 4,
  },
  {
    id: 'epsilon-cycle',
    name: 'ε-cycle',
    shortName: 'ε-cycle',
    description:
      'q0 ε→ q1 ε→ q2 ε→ q0 forms a cycle, so all three share one ε-closure. Accepts strings over {a,b} ending in b.',
    nfa: {
      states: ['q0', 'q1', 'q2', 'q3'],
      alphabet: ['a', 'b'],
      start: 'q0',
      finals: ['q3'],
      transitions: {
        q0: { a: ['q0'], [E]: ['q1'] },
        q1: { b: ['q1'], [E]: ['q2'] },
        q2: { b: ['q3'], [E]: ['q0'] },
      },
    },
    expected: {
      accepts: ['b', 'ab', 'bb', 'aab', 'abab', 'bbb'],
      rejects: ['', 'a', 'ba', 'bba', 'aaa'],
    },
    expectedDfaStates: 2,
    // "Ends in b" has two classes: last symbol b, or not.
    expectedMinStates: 2,
  },
  {
    id: 'epsilon-to-final',
    name: 'ε path to a final state',
    description:
      'Optional a followed by optional b, (a|ε)(b|ε). The start state reaches the final state by ε moves alone, so the empty string is accepted.',
    nfa: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      start: 'q0',
      finals: ['q2'],
      transitions: {
        q0: { a: ['q1'], [E]: ['q1'] },
        q1: { b: ['q2'], [E]: ['q2'] },
      },
    },
    expected: {
      accepts: ['', 'a', 'b', 'ab'],
      rejects: ['aa', 'ba', 'bb', 'abb', 'aab'],
    },
    expectedDfaStates: 4,
    // Classes: start, after a, after b or ab, dead.
    expectedMinStates: 4,
  },
  {
    id: 'ends-with-01',
    name: 'Plain NFA: ends in 01',
    description: 'An NFA without ε-transitions over {0,1} accepting strings that end in 01.',
    nfa: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['0', '1'],
      start: 'q0',
      finals: ['q2'],
      transitions: {
        q0: { '0': ['q0', 'q1'], '1': ['q0'] },
        q1: { '1': ['q2'] },
      },
    },
    expected: {
      accepts: ['01', '001', '101', '1101', '0101'],
      rejects: ['', '0', '1', '10', '011', '010', '0110'],
    },
    expectedDfaStates: 3,
    // Hopcroft, Motwani, Ullman, Introduction to Automata Theory, Fig. 2.14.
    expectedDfaTable: [
      { state: 'A', subset: ['q0'], final: false, on: { '0': 'B', '1': 'A' } },
      { state: 'B', subset: ['q0', 'q1'], final: false, on: { '0': 'B', '1': 'C' } },
      { state: 'C', subset: ['q0', 'q2'], final: true, on: { '0': 'B', '1': 'A' } },
    ],
    expectedMinStates: 3,
  },
  {
    id: 'unreachable-state',
    name: 'Unreachable state',
    description: 'Accepts ab*. State q2 has outgoing edges but nothing leads to it, so it never appears in the DFA.',
    nfa: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      start: 'q0',
      finals: ['q1'],
      transitions: {
        q0: { a: ['q1'] },
        q1: { b: ['q1'] },
        q2: { a: ['q1'], [E]: ['q0'] },
      },
    },
    expected: {
      accepts: ['a', 'ab', 'abb'],
      rejects: ['', 'b', 'aa', 'ba', 'aba'],
    },
    expectedDfaStates: 3,
    // Start, in ab*, dead; q2 never appears.
    expectedMinStates: 3,
  },
  {
    id: 'dead-state',
    name: 'Missing transitions (dead state ∅)',
    description: 'Accepts exactly "ab". Most transitions are missing, so subset construction produces the dead state ∅.',
    nfa: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      start: 'q0',
      finals: ['q2'],
      transitions: {
        q0: { a: ['q1'] },
        q1: { b: ['q2'] },
      },
    },
    expected: {
      accepts: ['ab'],
      rejects: ['', 'a', 'b', 'aa', 'ba', 'abb', 'aba'],
    },
    expectedDfaStates: 4,
    // Worked by hand: A·b and every move of C lead to the empty set ∅.
    expectedDfaTable: [
      { state: 'A', subset: ['q0'], final: false, on: { a: 'B', b: '∅' } },
      { state: 'B', subset: ['q1'], final: false, on: { a: '∅', b: 'C' } },
      { state: '∅', subset: [], final: false, on: { a: '∅', b: '∅' } },
      { state: 'C', subset: ['q2'], final: true, on: { a: '∅', b: '∅' } },
    ],
    expectedMinStates: 4,
  },
  {
    id: 'third-from-end',
    name: 'Third symbol from the end is 1',
    description:
      'A 4-state NFA whose DFA needs 2³ = 8 states: the DFA must remember the last three symbols. The classic blow-up example.',
    nfa: {
      states: ['q0', 'q1', 'q2', 'q3'],
      alphabet: ['0', '1'],
      start: 'q0',
      finals: ['q3'],
      transitions: {
        q0: { '0': ['q0'], '1': ['q0', 'q1'] },
        q1: { '0': ['q2'], '1': ['q2'] },
        q2: { '0': ['q3'], '1': ['q3'] },
      },
    },
    expected: {
      accepts: ['100', '101', '110', '111', '0100', '1111', '00110'],
      rejects: ['', '1', '10', '11', '000', '011', '1000', '0011'],
    },
    expectedDfaStates: 8,
    // All 2³ suffixes of length 3 are distinguishable, so nothing merges.
    expectedMinStates: 8,
  },
  {
    id: 'multi-char-symbols',
    name: 'Multi-character symbols',
    description:
      'Alphabet {if, x}: accepts one or more repetitions of "if x". Input is split by longest match, with or without spaces.',
    nfa: {
      states: ['q0', 'q1', 'q2'],
      alphabet: ['if', 'x'],
      start: 'q0',
      finals: ['q2'],
      transitions: {
        q0: { if: ['q1'] },
        q1: { x: ['q2'] },
        q2: { [E]: ['q0'] },
      },
    },
    expected: {
      accepts: ['ifx', 'if x', 'ifxifx', 'if x if x'],
      rejects: ['', 'if', 'x', 'ifif', 'xif', 'ifxx'],
    },
    expectedDfaStates: 4,
    // Classes: expecting "if", expecting "x", just finished "if x" (final), dead.
    expectedMinStates: 4,
  },
]

/**
 * Looks up a preset by id.
 *
 * @param id - The preset id.
 * @returns The preset, or `undefined` if there is none with that id.
 * @throws Never throws.
 */
export function getPreset(id: string): Preset | undefined {
  return presets.find((p) => p.id === id)
}
