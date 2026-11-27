import { describe, expect, it } from 'vitest'
import { minimizeDFA, subsetConstruction } from '../src/core'
import { presets } from '../src/presets'
import { dfaTableRows, formatDfaRows } from '../src/presets/compare'

describe('hand-derived expected results vs generated', () => {
  it('at least the textbook (a|b)*abb table is given', () => {
    expect(presets.find((p) => p.id === 'thompson-abb')?.expectedDfaTable).toHaveLength(5)
    expect(presets.every((p) => p.expectedMinStates !== undefined)).toBe(true)
  })

  for (const p of presets) {
    it(`${p.id}: DFA table and minimal state count match the expected answer`, () => {
      const { dfa } = subsetConstruction(p.nfa)
      if (p.expectedDfaTable) expect(dfaTableRows(dfa)).toEqual(p.expectedDfaTable)
      expect(minimizeDFA(dfa).dfa.states).toHaveLength(p.expectedMinStates!)
    })
  }

  it('formatDfaRows marks start, finals and missing moves', () => {
    const text = formatDfaRows(
      [
        { state: 'A', subset: ['p'], final: false, on: { a: 'B' } },
        { state: 'B', subset: ['q'], final: true, on: {} },
      ],
      ['a'],
    )
    expect(text).toBe('→A{p}: a→B; *B{q}: a→—')
  })
})
