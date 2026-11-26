import { describe, expect, it } from 'vitest'
import { InvalidAutomatonError } from '../src/core/automaton'
import { DEAD_STATE, dfaStateName, subsetConstruction } from '../src/core/subset'
import type { ENFA } from '../src/core/types'
import { getPreset } from '../src/presets'

const thompson = getPreset('thompson-abb')!.nfa

describe('subsetConstruction on the Thompson (a|b)*abb ε-NFA', () => {
  const { dfa, steps, stats } = subsetConstruction(thompson)

  it('builds exactly the textbook subsets A–E', () => {
    expect(dfa.states).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(dfa.subsets).toEqual({
      A: ['0', '1', '2', '4', '7'],
      B: ['1', '2', '3', '4', '6', '7', '8'],
      C: ['1', '2', '4', '5', '6', '7'],
      D: ['1', '2', '4', '5', '6', '7', '9'],
      E: ['1', '2', '4', '5', '6', '7', '10'],
    })
  })

  it('builds exactly the textbook transition table', () => {
    expect(dfa.transitions).toEqual({
      A: { a: 'B', b: 'C' },
      B: { a: 'B', b: 'D' },
      C: { a: 'B', b: 'C' },
      D: { a: 'B', b: 'E' },
      E: { a: 'B', b: 'C' },
    })
    expect(dfa.start).toBe('A')
    expect(dfa.finals).toEqual(['E'])
    expect(dfa.deadState).toBeNull()
  })

  it('records a start step, one step per (state, symbol), and a done step', () => {
    expect(steps).toHaveLength(1 + 5 * 2 + 1)
    expect(steps[0].kind).toBe('start')
    expect(steps[0].explanation).toBe('Start state A = ε-closure({0}) = {0,1,2,4,7}.')
    expect(steps.at(-1)!.kind).toBe('done')
    steps.forEach((s, i) => expect(s.index).toBe(i))
  })

  it('explains each step in a full sentence', () => {
    const bOnB = steps.find((s) => s.from === 'B' && s.symbol === 'b')!
    expect(bOnB.moveSet).toEqual(['5', '9'])
    expect(bOnB.closureSet).toEqual(['1', '2', '4', '5', '6', '7', '9'])
    expect(bOnB.isNew).toBe(true)
    expect(bOnB.explanation).toBe(
      'From B = {1,2,3,4,6,7,8} on b: move = {5,9}, ε-closure = {1,2,4,5,6,7,9}, a new state D.',
    )
    const cOnA = steps.find((s) => s.from === 'C' && s.symbol === 'a')!
    expect(cOnA.isNew).toBe(false)
    expect(cOnA.explanation).toMatch(/the existing state B\.$/)
    const dOnB = steps.find((s) => s.from === 'D' && s.symbol === 'b')!
    expect(dOnB.explanation).toMatch(/a new final state E\.$/)
  })

  it('processes states in BFS order and symbols in alphabet order', () => {
    const order = steps.filter((s) => s.kind === 'transition').map((s) => `${s.from}${s.symbol}`)
    expect(order).toEqual(['Aa', 'Ab', 'Ba', 'Bb', 'Ca', 'Cb', 'Da', 'Db', 'Ea', 'Eb'])
  })

  it('reports statistics', () => {
    expect(stats.nfaStates).toBe(11)
    expect(stats.dfaStates).toBe(5)
    expect(stats.upperBound).toBe(2048)
    expect(stats.ms).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic', () => {
    expect(subsetConstruction(thompson).dfa).toEqual(dfa)
  })
})

describe('dead state handling', () => {
  const nfa = getPreset('dead-state')!.nfa

  it('adds ∅ with self-loops by default', () => {
    const { dfa, steps } = subsetConstruction(nfa)
    expect(dfa.states).toEqual(['A', 'B', DEAD_STATE, 'C'])
    expect(dfa.deadState).toBe(DEAD_STATE)
    expect(dfa.subsets[DEAD_STATE]).toEqual([])
    expect(dfa.transitions[DEAD_STATE]).toEqual({ a: DEAD_STATE, b: DEAD_STATE })
    expect(dfa.transitions.A).toEqual({ a: 'B', b: DEAD_STATE })
    const step = steps.find((s) => s.from === 'A' && s.symbol === 'b')!
    expect(step.explanation).toBe('From A = {q0} on b: move = ∅, ε-closure = ∅, a new dead state ∅.')
  })

  it('leaves transitions undefined with includeDeadState: false', () => {
    const { dfa, steps } = subsetConstruction(nfa, { includeDeadState: false })
    expect(dfa.states).toEqual(['A', 'B', 'C'])
    expect(dfa.deadState).toBeNull()
    expect(dfa.transitions.A).toEqual({ a: 'B' })
    expect(dfa.transitions.C).toEqual({})
    const step = steps.find((s) => s.from === 'A' && s.symbol === 'b')!
    expect(step.to).toBeNull()
    expect(step.explanation).toMatch(/no transition \(partial DFA\)\.$/)
  })
})

describe('state naming', () => {
  it('goes A…Z, then A1…Z1, then A2', () => {
    expect(dfaStateName(0)).toBe('A')
    expect(dfaStateName(25)).toBe('Z')
    expect(dfaStateName(26)).toBe('A1')
    expect(dfaStateName(51)).toBe('Z1')
    expect(dfaStateName(52)).toBe('A2')
    expect(() => dfaStateName(-1)).toThrow(RangeError)
  })

  it('uses suffixed names when there are more than 26 DFA states', () => {
    // n-th symbol from the end is 1, n = 5: 2^5 = 32 DFA states.
    const states = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5']
    const transitions: ENFA['transitions'] = { q0: { '0': ['q0'], '1': ['q0', 'q1'] } }
    for (let i = 1; i < 5; i++) transitions[`q${i}`] = { '0': [`q${i + 1}`], '1': [`q${i + 1}`] }
    const { dfa } = subsetConstruction({ states, alphabet: ['0', '1'], start: 'q0', finals: ['q5'], transitions })
    expect(dfa.states).toHaveLength(32)
    expect(dfa.states.slice(24, 28)).toEqual(['Y', 'Z', 'A1', 'B1'])
    expect(dfa.states.at(-1)).toBe('F1')
  })
})

describe('final states', () => {
  it('marks a DFA state final if its subset holds any NFA final state', () => {
    const { dfa } = subsetConstruction(getPreset('epsilon-to-final')!.nfa)
    expect(dfa.finals).toEqual(['A', 'B', 'C'])
    expect(dfa.subsets.A).toEqual(['q0', 'q1', 'q2'])
  })
})

describe('invalid input', () => {
  it('throws InvalidAutomatonError for an invalid ε-NFA', () => {
    const bad: ENFA = { states: ['q0'], alphabet: ['a'], start: 'qx', finals: [], transitions: {} }
    expect(() => subsetConstruction(bad)).toThrow(InvalidAutomatonError)
  })
})
