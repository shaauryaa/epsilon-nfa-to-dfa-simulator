import { describe, expect, it } from 'vitest'
import { closureTable, epsilonClosure, epsilonClosureTrace, move } from '../src/core/closure'
import { formatSet, indexOrder, sortByOrder } from '../src/core/sets'
import { EPSILON, type ENFA } from '../src/core/types'
import { getPreset } from '../src/presets'

const thompson = getPreset('thompson-abb')!.nfa
const cycle = getPreset('epsilon-cycle')!.nfa

describe('epsilonClosure', () => {
  it('computes the textbook closure of the Thompson start state', () => {
    expect(epsilonClosure(thompson, ['0'])).toEqual(['0', '1', '2', '4', '7'])
  })

  it('returns results in declaration order, not discovery order', () => {
    expect(epsilonClosure(thompson, ['8', '3'])).toEqual(['1', '2', '3', '4', '6', '7', '8'])
  })

  it('includes the given states even without ε-edges', () => {
    expect(epsilonClosure(thompson, ['9'])).toEqual(['9'])
  })

  it('returns [] for the empty set', () => {
    expect(epsilonClosure(thompson, [])).toEqual([])
  })

  it('terminates on an ε-cycle and returns the whole cycle', () => {
    expect(epsilonClosure(cycle, ['q1'])).toEqual(['q0', 'q1', 'q2'])
  })

  it('handles an ε self-loop', () => {
    const nfa: ENFA = { states: ['p'], alphabet: ['a'], start: 'p', finals: [], transitions: { p: { [EPSILON]: ['p'] } } }
    expect(epsilonClosure(nfa, ['p'])).toEqual(['p'])
  })

  it('ignores duplicate inputs', () => {
    expect(epsilonClosure(thompson, ['0', '0', '1'])).toEqual(['0', '1', '2', '4', '7'])
  })
})

describe('epsilonClosureTrace', () => {
  it('lists every ε-edge followed, in DFS order', () => {
    const { closure, edges } = epsilonClosureTrace(thompson, ['0'])
    expect(closure).toEqual(['0', '1', '2', '4', '7'])
    expect(edges).toEqual([
      ['0', '1'],
      ['0', '7'],
      ['1', '2'],
      ['1', '4'],
    ])
  })

  it('reports cycle-closing edges once', () => {
    const { edges } = epsilonClosureTrace(cycle, ['q0'])
    expect(edges).toEqual([
      ['q0', 'q1'],
      ['q1', 'q2'],
      ['q2', 'q0'],
    ])
  })
})

describe('move', () => {
  it('follows exactly one symbol edge from each state', () => {
    expect(move(thompson, ['0', '1', '2', '4', '7'], 'a')).toEqual(['3', '8'])
    expect(move(thompson, ['0', '1', '2', '4', '7'], 'b')).toEqual(['5'])
  })

  it('does not apply ε-closure', () => {
    expect(move(thompson, ['0'], 'a')).toEqual([])
  })

  it('merges duplicate targets and sorts by declaration order', () => {
    const nfa: ENFA = {
      states: ['x', 'y', 'z'],
      alphabet: ['a'],
      start: 'x',
      finals: [],
      transitions: { x: { a: ['z', 'y'] }, y: { a: ['y'] } },
    }
    expect(move(nfa, ['x', 'y'], 'a')).toEqual(['y', 'z'])
  })
})

describe('closureTable', () => {
  it('has one entry per state in declaration order', () => {
    const table = closureTable(thompson)
    expect(Object.keys(table)).toEqual(thompson.states)
    expect(table['6']).toEqual(['1', '2', '4', '6', '7'])
    expect(table['10']).toEqual(['10'])
  })
})

describe('set helpers', () => {
  it('formats sets and the empty set', () => {
    expect(formatSet(['1', '2'])).toBe('{1,2}')
    expect(formatSet([])).toBe('∅')
  })

  it('sorts undeclared names after declared ones', () => {
    expect(sortByOrder(indexOrder(['b', 'a']), ['z', 'a', 'y', 'b', 'a'])).toEqual(['b', 'a', 'y', 'z'])
  })
})
