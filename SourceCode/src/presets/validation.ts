/**
 * Deliberately broken (or suspicious) machines, one per validation code.
 * Used by the unit tests and the test report, and handy for demonstrating
 * the validator in the UI.
 */

import type { ErrorCode, WarningCode } from '../core/automaton'
import { EPSILON, type ENFA } from '../core/types'

/** A machine that must trigger a specific validation code. */
export interface ValidationCase {
  code: ErrorCode | WarningCode
  severity: 'error' | 'warning'
  description: string
  nfa: ENFA
}

const E = EPSILON

/** A small valid ε-NFA used as the base for each broken variant. */
function base(): ENFA {
  return {
    states: ['q0', 'q1'],
    alphabet: ['a'],
    start: 'q0',
    finals: ['q1'],
    transitions: { q0: { a: ['q1'], [E]: ['q1'] } },
  }
}

function variant(change: Partial<ENFA>): ENFA {
  return { ...base(), ...change }
}

export const validationCases: ValidationCase[] = [
  {
    code: 'NO_STATES',
    severity: 'error',
    description: 'No states declared',
    nfa: { states: [], alphabet: ['a'], start: '', finals: [], transitions: {} },
  },
  { code: 'EMPTY_ALPHABET', severity: 'error', description: 'Empty alphabet', nfa: variant({ alphabet: [], transitions: { q0: { [E]: ['q1'] } } }) },
  { code: 'DUPLICATE_STATE', severity: 'error', description: 'State q1 declared twice', nfa: variant({ states: ['q0', 'q1', 'q1'] }) },
  { code: 'DUPLICATE_SYMBOL', severity: 'error', description: 'Symbol a declared twice', nfa: variant({ alphabet: ['a', 'a'] }) },
  { code: 'NO_START', severity: 'error', description: 'Start state missing', nfa: variant({ start: '' }) },
  { code: 'START_NOT_A_STATE', severity: 'error', description: 'Start state q9 not declared', nfa: variant({ start: 'q9' }) },
  { code: 'FINAL_NOT_A_STATE', severity: 'error', description: 'Final state q9 not declared', nfa: variant({ finals: ['q1', 'q9'] }) },
  {
    code: 'UNKNOWN_SOURCE_STATE',
    severity: 'error',
    description: 'Transition from undeclared q9',
    nfa: variant({ transitions: { q0: { a: ['q1'], [E]: ['q1'] }, q9: { a: ['q1'] } } }),
  },
  {
    code: 'UNKNOWN_TARGET_STATE',
    severity: 'error',
    description: 'Transition to undeclared q9',
    nfa: variant({ transitions: { q0: { a: ['q9'], [E]: ['q1'] } } }),
  },
  {
    code: 'UNKNOWN_SYMBOL',
    severity: 'error',
    description: 'Transition on b, which is not in the alphabet',
    nfa: variant({ transitions: { q0: { b: ['q1'], [E]: ['q1'] } } }),
  },
  { code: 'EPSILON_IN_ALPHABET', severity: 'error', description: 'ε listed as an alphabet symbol', nfa: variant({ alphabet: ['a', E] }) },
  { code: 'INVALID_NAME', severity: 'error', description: 'State name contains a space', nfa: variant({ states: ['q0', 'q 1'], finals: [] }) },
  { code: 'NO_FINALS', severity: 'warning', description: 'No final states', nfa: variant({ finals: [] }) },
  { code: 'UNREACHABLE_STATE', severity: 'warning', description: 'State q2 unreachable', nfa: variant({ states: ['q0', 'q1', 'q2'] }) },
  { code: 'NO_EPSILON', severity: 'warning', description: 'No ε-transitions (plain NFA)', nfa: variant({ transitions: { q0: { a: ['q1'] } } }) },
]
