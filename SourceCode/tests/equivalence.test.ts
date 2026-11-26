import { describe, expect, it } from 'vitest'
import { accepts, allStrings, checkEquivalence, isDFA } from '../src/core/equivalence'
import { subsetConstruction } from '../src/core/subset'
import { getPreset } from '../src/presets'

describe('allStrings', () => {
  it('enumerates by length, then alphabet order', () => {
    expect([...allStrings(['a', 'b'], 2)].map((t) => t.join(''))).toEqual(['', 'a', 'b', 'aa', 'ab', 'ba', 'bb'])
  })

  it('yields Σ|Σ|^k strings', () => {
    expect([...allStrings(['0', '1', '2'], 4)]).toHaveLength(1 + 3 + 9 + 27 + 81)
  })

  it('keeps multi-character symbols intact', () => {
    expect([...allStrings(['if', 'x'], 1)]).toEqual([[], ['if'], ['x']])
  })

  it('handles an empty alphabet and negative length', () => {
    expect([...allStrings([], 3)]).toEqual([[]])
    expect([...allStrings(['a'], -1)]).toEqual([])
  })
})

describe('checkEquivalence', () => {
  const nfa = getPreset('thompson-abb')!.nfa
  const { dfa } = subsetConstruction(nfa)

  it('finds an ε-NFA and its DFA equivalent', () => {
    const r = checkEquivalence(nfa, dfa, 6)
    expect(r).toEqual({ agree: true, tested: 127, exhaustive: true })
  })

  it('returns the shortest counterexample', () => {
    const other = getPreset('ends-with-01')!.nfa
    const swapped = { ...other, alphabet: ['a', 'b'], transitions: { q0: { a: ['q0', 'q1'], b: ['q0'] }, q1: { b: ['q2'] } } }
    const r = checkEquivalence(nfa, swapped)
    expect(r.agree).toBe(false)
    expect(r.counterexample).toEqual({ tokens: ['a', 'b'], input: 'ab', acceptedByA: false, acceptedByB: true })
  })

  it('stops at the cap', () => {
    expect(checkEquivalence(nfa, dfa, 8, 10)).toEqual({ agree: true, tested: 10, exhaustive: false })
  })

  it('space-separates multi-character counterexamples', () => {
    const m = getPreset('multi-char-symbols')!.nfa
    const r = checkEquivalence(m, { ...m, finals: ['q1'] })
    expect(r.counterexample!.input).toBe('if')
    const r2 = checkEquivalence(m, { ...m, finals: [] }, 3)
    expect(r2.counterexample!.input).toBe('if x')
  })

  it('detects automaton kinds', () => {
    expect(isDFA(dfa)).toBe(true)
    expect(isDFA(nfa)).toBe(false)
    const { subsets: _s, ...bare } = dfa
    expect(isDFA(bare as never)).toBe(true)
    expect(accepts(dfa, ['a', 'b', 'b'])).toBe(true)
    expect(accepts(nfa, ['a', 'b', 'b'])).toBe(true)
  })
})
