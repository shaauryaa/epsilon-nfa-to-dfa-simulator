import { describe, expect, it } from 'vitest'
import { InputSymbolError, simulateDFA, simulateENFA, tokenize } from '../src/core/simulate'
import { subsetConstruction } from '../src/core/subset'
import { getPreset } from '../src/presets'

describe('tokenize', () => {
  it('splits single-character alphabets into characters', () => {
    expect(tokenize('abba', ['a', 'b'])).toEqual(['a', 'b', 'b', 'a'])
  })

  it('ignores whitespace', () => {
    expect(tokenize(' a b\tb\n', ['a', 'b'])).toEqual(['a', 'b', 'b'])
  })

  it('treats the empty string as ε', () => {
    expect(tokenize('', ['a'])).toEqual([])
    expect(tokenize('   ', ['a'])).toEqual([])
    expect(tokenize('', ['if', 'x'])).toEqual([])
  })

  it('uses longest match for multi-character symbols', () => {
    expect(tokenize('ifxifx', ['if', 'x'])).toEqual(['if', 'x', 'if', 'x'])
    expect(tokenize('if x', ['if', 'x'])).toEqual(['if', 'x'])
    expect(tokenize('aab', ['a', 'ab', 'b'])).toEqual(['a', 'ab'])
    expect(tokenize('abab', ['ab', 'a', 'b'])).toEqual(['ab', 'ab'])
  })

  it('handles non-ASCII single-character symbols', () => {
    expect(tokenize('αβα', ['α', 'β'])).toEqual(['α', 'β', 'α'])
  })

  it('throws InputSymbolError with position and character', () => {
    try {
      tokenize('abca', ['a', 'b'])
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(InputSymbolError)
      expect((e as InputSymbolError).position).toBe(2)
      expect((e as InputSymbolError).character).toBe('c')
    }
    try {
      tokenize('if y', ['if', 'x'])
      expect.unreachable()
    } catch (e) {
      expect((e as InputSymbolError).position).toBe(3)
      expect((e as InputSymbolError).character).toBe('y')
    }
    // Greedy matching does not backtrack.
    expect(() => tokenize('i', ['if', 'x'])).toThrow(InputSymbolError)
  })

  it('counts positions including skipped whitespace', () => {
    expect(() => tokenize('a  z', ['a'])).toThrow(/position 3/)
  })
})

describe('simulateENFA', () => {
  const nfa = getPreset('thompson-abb')!.nfa

  it('starts from the ε-closure of the start state', () => {
    const run = simulateENFA(nfa, [])
    expect(run.initial).toEqual(['0', '1', '2', '4', '7'])
    expect(run.steps).toEqual([])
    expect(run.accepted).toBe(false)
  })

  it('records before, moved and after for each symbol', () => {
    const run = simulateENFA(nfa, ['a', 'b', 'b'])
    expect(run.accepted).toBe(true)
    expect(run.steps[0]).toEqual({
      symbol: 'a',
      before: ['0', '1', '2', '4', '7'],
      moved: ['3', '8'],
      after: ['1', '2', '3', '4', '6', '7', '8'],
    })
    expect(run.steps[2].after).toContain('10')
    expect(run.final).toEqual(run.steps[2].after)
  })

  it('stays empty once the set of states dies', () => {
    const run = simulateENFA(getPreset('dead-state')!.nfa, ['b', 'a'])
    expect(run.steps.map((s) => s.after)).toEqual([[], []])
    expect(run.accepted).toBe(false)
  })

  it('accepts ε when a final state is ε-reachable', () => {
    expect(simulateENFA(getPreset('epsilon-to-final')!.nfa, []).accepted).toBe(true)
  })
})

describe('simulateDFA', () => {
  const nfa = getPreset('dead-state')!.nfa

  it('follows the path through a complete DFA', () => {
    const { dfa } = subsetConstruction(nfa)
    const run = simulateDFA(dfa, ['a', 'b'])
    expect(run.accepted).toBe(true)
    expect(run.path).toEqual(['A', 'B', 'C'])
    expect(run.steps[1]).toMatchObject({ from: 'B', to: 'C', symbol: 'b' })
    expect(run.steps[1].explanation).toBe('B --b--> C {q2} (final).')
  })

  it('goes to ∅ and rejects in a complete DFA', () => {
    const { dfa } = subsetConstruction(nfa)
    const run = simulateDFA(dfa, ['b', 'a'])
    expect(run.path).toEqual(['A', '∅', '∅'])
    expect(run.accepted).toBe(false)
  })

  it('rejects on a missing transition in a partial DFA and says so', () => {
    const { dfa } = subsetConstruction(nfa, { includeDeadState: false })
    const run = simulateDFA(dfa, ['b', 'a'])
    expect(run.accepted).toBe(false)
    expect(run.path).toEqual(['A'])
    expect(run.steps).toHaveLength(1)
    expect(run.steps[0].to).toBeNull()
    expect(run.steps[0].explanation).toBe('No transition from A on b: the input is rejected (partial DFA).')
  })

  it('accepts ε iff the start state is final', () => {
    expect(simulateDFA(subsetConstruction(nfa).dfa, []).accepted).toBe(false)
    expect(simulateDFA(subsetConstruction(getPreset('epsilon-to-final')!.nfa).dfa, []).accepted).toBe(true)
  })
})
