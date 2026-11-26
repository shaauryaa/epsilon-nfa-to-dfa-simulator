import { describe, expect, it } from 'vitest'
import { validateENFA } from '../src/core/automaton'
import { allStrings } from '../src/core/equivalence'
import { minimizeDFA } from '../src/core/minimize'
import { simulateDFA, simulateENFA } from '../src/core/simulate'
import { subsetConstruction } from '../src/core/subset'
import { mulberry32, randomENFA } from './helpers'

describe('property: ε-NFA ≡ DFA ≡ minimal DFA on random machines', () => {
  it('agree on every string up to length 6 for 500 seeded random ε-NFAs', () => {
    const rand = mulberry32(20261126)
    const strings = [...allStrings(['a', 'b'], 6)]
    expect(strings).toHaveLength(127)
    let withEpsilon = 0
    for (let i = 0; i < 500; i++) {
      const nfa = randomENFA(rand)
      expect(validateENFA(nfa).errors).toEqual([])
      if (!validateENFA(nfa).warnings.some((w) => w.code === 'NO_EPSILON')) withEpsilon++

      const { dfa } = subsetConstruction(nfa)
      const { dfa: partial } = subsetConstruction(nfa, { includeDeadState: false })
      const { dfa: min } = minimizeDFA(dfa)
      expect(min.states.length, `machine ${i}`).toBeLessThanOrEqual(dfa.states.length)
      expect(minimizeDFA(partial).dfa.states.length, `machine ${i}`).toBe(min.states.length)

      for (const s of strings) {
        const want = simulateENFA(nfa, s).accepted
        const ctx = `machine ${i}, input "${s.join('')}"`
        expect(simulateDFA(dfa, s).accepted, ctx).toBe(want)
        expect(simulateDFA(partial, s).accepted, ctx).toBe(want)
        expect(simulateDFA(min, s).accepted, ctx).toBe(want)
      }
    }
    // Sanity check that the generator really exercises ε-transitions.
    expect(withEpsilon).toBeGreaterThan(250)
  })
})
