import { describe, expect, it } from 'vitest'
import { minimizeDFA, subsetConstruction } from '../src/core'
import { deadStateNote, hasMissingMoves, minimisationSummary } from '../src/model/reportText'
import { getPreset } from '../src/presets'

const deadPreset = getPreset('dead-state')!.nfa
const abb = getPreset('thompson-abb')!.nfa

describe('PDF dead-state wording follows the toggle and the DFA', () => {
  it('names ∅ when it is shown', () => {
    const dfa = subsetConstruction(deadPreset).dfa
    expect(deadStateNote(dfa, true)).toMatch(/^∅ is the dead state/)
  })

  it('says the DFA is partial when ∅ is hidden and moves are missing', () => {
    const dfa = subsetConstruction(deadPreset, { includeDeadState: false }).dfa
    expect(hasMissingMoves(dfa)).toBe(true)
    expect(deadStateNote(dfa, false)).toMatch(/hidden .* partial: a missing move means reject/)
  })

  it('never claims missing moves when the DFA is complete, whatever the toggle', () => {
    for (const showDead of [true, false]) {
      const dfa = subsetConstruction(abb, { includeDeadState: showDead }).dfa
      expect(hasMissingMoves(dfa)).toBe(false)
      expect(deadStateNote(dfa, showDead)).toBe('Every state has a move on every symbol, so no dead state is needed and the DFA is complete.')
    }
  })
})

describe('minimisation summary', () => {
  it('(a|b)*abb: 5 → 4 states, A and C merged', () => {
    const dfa = subsetConstruction(abb).dfa
    const s = minimisationSummary(dfa, minimizeDFA(dfa))
    expect(s.text).toBe('Partition refinement reduces the DFA from 5 to 4 states.')
    expect(s.merged).toEqual(['{A,C} → {A,C}'])
    expect(s.removed).toEqual([])
  })

  it('an already minimal DFA says so', () => {
    const dfa = subsetConstruction(getPreset('third-from-end')!.nfa).dfa
    expect(minimisationSummary(dfa, minimizeDFA(dfa)).text).toMatch(/already minimal: all 8 states/)
  })

  it('a partial DFA mentions the added dead state', () => {
    const dfa = subsetConstruction(deadPreset, { includeDeadState: false }).dfa
    expect(minimisationSummary(dfa, minimizeDFA(dfa)).text).toMatch(/dead state was added/)
  })
})
