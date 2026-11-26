import { describe, expect, it } from 'vitest'
import { checkEquivalence } from '../src/core/equivalence'
import { mergedName, minimizeDFA } from '../src/core/minimize'
import { subsetConstruction } from '../src/core/subset'
import type { DFA } from '../src/core/types'
import { getPreset, presets } from '../src/presets'

function dfa(partial: Partial<DFA> & Pick<DFA, 'states' | 'transitions'>): DFA {
  return { alphabet: ['a', 'b'], start: partial.states[0], finals: [], subsets: {}, deadState: null, ...partial }
}

describe('minimizeDFA on the Thompson (a|b)*abb DFA', () => {
  const big = subsetConstruction(getPreset('thompson-abb')!.nfa).dfa
  const { dfa: min, steps, mapping, removedUnreachable } = minimizeDFA(big)

  it('merges A and C, giving the 4-state textbook minimal DFA', () => {
    expect(min.states).toEqual(['{A,C}', 'B', 'D', 'E'])
    expect(min.start).toBe('{A,C}')
    expect(min.finals).toEqual(['E'])
    expect(min.transitions).toEqual({
      '{A,C}': { a: 'B', b: '{A,C}' },
      B: { a: 'B', b: 'D' },
      D: { a: 'B', b: 'E' },
      E: { a: 'B', b: '{A,C}' },
    })
    expect(mapping).toEqual({ A: '{A,C}', C: '{A,C}', B: 'B', D: 'D', E: 'E' })
    expect(removedUnreachable).toEqual([])
  })

  it('records each refinement round and the symbol that caused each split', () => {
    const rounds = steps.filter((s) => s.kind === 'partition')
    expect(rounds.map((r) => r.partition)).toEqual([
      [['A', 'B', 'C', 'D'], ['E']],
      [['A', 'B', 'C'], ['D'], ['E']],
      [['A', 'C'], ['B'], ['D'], ['E']],
    ])
    expect(rounds[1].splits).toEqual([{ group: ['A', 'B', 'C', 'D'], symbol: 'b', into: [['A', 'B', 'C'], ['D']] }])
    expect(rounds[2].splits).toEqual([{ group: ['A', 'B', 'C'], symbol: 'b', into: [['A', 'C'], ['B']] }])
    expect(rounds[2].explanation).toBe('Round 2: {A,B,C} splits on b into {A,C} {B}.')
    expect(steps.map((s) => s.kind)).toEqual(['unreachable', 'complete', 'partition', 'partition', 'partition', 'done'])
  })

  it('unions the NFA subsets of merged states', () => {
    expect(min.subsets['{A,C}']).toEqual(['0', '1', '2', '4', '7', '5', '6'])
  })
})

describe('unreachable states', () => {
  it('removes them before refinement', () => {
    const input = dfa({
      states: ['p', 'q', 'r'],
      finals: ['q'],
      transitions: { p: { a: 'q', b: 'p' }, q: { a: 'q', b: 'p' }, r: { a: 'p', b: 'q' } },
    })
    const { dfa: min, removedUnreachable, steps } = minimizeDFA(input)
    expect(removedUnreachable).toEqual(['r'])
    expect(min.states).toEqual(['p', 'q'])
    expect(steps[0]).toMatchObject({ kind: 'unreachable', removed: ['r'] })
    expect(steps[0].explanation).toBe('Removed unreachable state r.')
  })
})

describe('partial DFAs', () => {
  it('completes the DFA with a dead state first', () => {
    const input = dfa({ states: ['p', 'q'], finals: ['q'], transitions: { p: { a: 'q' }, q: {} } })
    const { dfa: min, steps } = minimizeDFA(input)
    expect(steps[1]).toMatchObject({
      kind: 'complete',
      deadState: '∅',
      added: [
        { from: 'p', symbol: 'b' },
        { from: 'q', symbol: 'a' },
        { from: 'q', symbol: 'b' },
      ],
    })
    expect(min.states).toEqual(['p', 'q', '∅'])
    expect(min.deadState).toBe('∅')
    expect(min.transitions['∅']).toEqual({ a: '∅', b: '∅' })
  })

  it('reuses the DFA deadState name and avoids collisions', () => {
    const input = dfa({ states: ['∅', 'q'], finals: ['q'], transitions: { '∅': { a: 'q' }, q: {} } })
    const { steps } = minimizeDFA(input)
    expect(steps[1]).toMatchObject({ kind: 'complete', deadState: "∅'" })
  })

  it('merges equivalent dead states', () => {
    const input = dfa({
      states: ['p', 'd1', 'd2'],
      finals: ['p'],
      transitions: { p: { a: 'd1', b: 'd2' }, d1: { a: 'd2', b: 'd1' }, d2: { a: 'd1', b: 'd2' } },
    })
    const { dfa: min } = minimizeDFA(input)
    expect(min.states).toEqual(['p', '{d1,d2}'])
    expect(min.deadState).toBe('{d1,d2}')
  })
})

describe('edge cases', () => {
  it('handles a DFA where every state is final', () => {
    const input = dfa({ states: ['p', 'q'], finals: ['p', 'q'], transitions: { p: { a: 'q', b: 'p' }, q: { a: 'p', b: 'q' } } })
    expect(minimizeDFA(input).dfa.states).toEqual(['{p,q}'])
  })

  it('names singleton groups by their old name', () => {
    expect(mergedName(['A'])).toBe('A')
    expect(mergedName(['A', 'C'])).toBe('{A,C}')
  })

  it('is idempotent', () => {
    for (const p of presets) {
      const once = minimizeDFA(subsetConstruction(p.nfa).dfa).dfa
      const twice = minimizeDFA(once).dfa
      expect(twice.states.length).toBe(once.states.length)
    }
  })

  it('gives 8 states for the third-from-end blow-up (already minimal)', () => {
    const big = subsetConstruction(getPreset('third-from-end')!.nfa).dfa
    const min = minimizeDFA(big).dfa
    expect(min.states).toHaveLength(8)
    expect(checkEquivalence(big, min, 8).agree).toBe(true)
  })
})
