import { describe, expect, it } from 'vitest'
import { validateENFA } from '../src/core/automaton'
import { minimizeDFA } from '../src/core/minimize'
import { simulateDFA, simulateENFA, tokenize } from '../src/core/simulate'
import { subsetConstruction } from '../src/core/subset'
import { getPreset, presets } from '../src/presets'

describe('presets', () => {
  it('have unique ids', () => {
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length)
    expect(getPreset('nope')).toBeUndefined()
  })

  for (const p of presets) {
    describe(p.name, () => {
      const dfa = subsetConstruction(p.nfa).dfa
      const partial = subsetConstruction(p.nfa, { includeDeadState: false }).dfa
      const min = minimizeDFA(dfa).dfa

      it('is valid', () => {
        expect(validateENFA(p.nfa).errors).toEqual([])
      })

      if (p.expectedDfaStates !== undefined) {
        it(`has ${p.expectedDfaStates} DFA states`, () => {
          expect(dfa.states).toHaveLength(p.expectedDfaStates!)
        })
      }

      it('has a minimal DFA no larger than the DFA', () => {
        expect(min.states.length).toBeLessThanOrEqual(dfa.states.length)
      })

      for (const [input, want] of [
        ...p.expected.accepts.map((s) => [s, true] as const),
        ...p.expected.rejects.map((s) => [s, false] as const),
      ]) {
        it(`${want ? 'accepts' : 'rejects'} ${JSON.stringify(input)} on ε-NFA, DFA, partial DFA and minimal DFA`, () => {
          const tokens = tokenize(input, p.nfa.alphabet)
          expect(simulateENFA(p.nfa, tokens).accepted).toBe(want)
          expect(simulateDFA(dfa, tokens).accepted).toBe(want)
          expect(simulateDFA(partial, tokens).accepted).toBe(want)
          expect(simulateDFA(min, tokens).accepted).toBe(want)
        })
      }
    })
  }

  it('include the required warning examples', () => {
    const codes = (id: string) => validateENFA(getPreset(id)!.nfa).warnings.map((w) => w.code)
    expect(codes('ends-with-01')).toContain('NO_EPSILON')
    expect(codes('unreachable-state')).toContain('UNREACHABLE_STATE')
    expect(Object.values(subsetConstruction(getPreset('unreachable-state')!.nfa).dfa.subsets).flat()).not.toContain('q2')
  })
})
