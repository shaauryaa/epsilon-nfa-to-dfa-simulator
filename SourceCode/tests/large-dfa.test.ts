import dagre from 'dagre'
import { describe, expect, it, vi } from 'vitest'
import { MAX_DFA_STATES, StateLimitError, subsetConstruction } from '../src/core'
import { layoutDFA } from '../src/model/dfaLayout'
import { gridLayout, isTooLargeToDraw, largeDfaNotice, LARGE_TABLE_PAGE, MAX_DRAWN_DFA_STATES, pageOf, superscript } from '../src/model/largeDfa'
import { derive } from '../src/store/derive'
import { getConversion } from '../src/store/convert'
import { kthFromEnd } from './helpers'

describe('subset construction state cap', () => {
  it('builds the 4096-state DFA of the 13-state "12th from the end" machine without throwing', () => {
    const r = subsetConstruction(kthFromEnd(12))
    expect(r.dfa.states).toHaveLength(4096)
    expect(MAX_DFA_STATES).toBe(4096)
  })

  it('stops with a StateLimitError past the cap', () => {
    expect(() => subsetConstruction(kthFromEnd(13))).toThrow(StateLimitError)
    try {
      subsetConstruction(kthFromEnd(13))
    } catch (e) {
      expect(e).toBeInstanceOf(StateLimitError)
      expect((e as StateLimitError).limit).toBe(4096)
      expect((e as StateLimitError).nfaStates).toBe(14)
      expect((e as Error).message).toMatch(/stopped at 4,096 DFA states/)
    }
  })

  it('honours a custom maxStates and rejects a bad one', () => {
    expect(() => subsetConstruction(kthFromEnd(3), { maxStates: 7 })).toThrow(StateLimitError)
    expect(subsetConstruction(kthFromEnd(3), { maxStates: 8 }).dfa.states).toHaveLength(8)
    expect(() => subsetConstruction(kthFromEnd(3), { maxStates: 0 })).toThrow(RangeError)
    expect(() => subsetConstruction(kthFromEnd(3), { maxStates: 2.5 })).toThrow(RangeError)
  })

  it('derive reports the cap as a calm error instead of throwing', () => {
    const d = derive(kthFromEnd(13))
    expect(d.validation.errors).toEqual([])
    expect(d.subset).toBeNull()
    expect(d.error).toMatch(/too many to build/)
  })
})

describe('large-DFA guard', () => {
  it('draws up to MAX_DRAWN_DFA_STATES and no more', () => {
    expect(MAX_DRAWN_DFA_STATES).toBe(60)
    expect(isTooLargeToDraw(60)).toBe(false)
    expect(isTooLargeToDraw(61)).toBe(true)
    expect(isTooLargeToDraw(4096)).toBe(true)
  })

  it('names exact powers of two as the 2ⁿ worst case', () => {
    expect(largeDfaNotice(1024)).toBe('1024 states: the 2ⁿ worst case (2¹⁰). The diagram and step animation are hidden; the table is complete.')
    expect(largeDfaNotice(65, true)).toMatch(/^65 states: the 2ⁿ worst case \(2⁶ \+ ∅\)/)
    expect(largeDfaNotice(100)).toMatch(/^100 states: more than 60 can be drawn clearly\./)
    expect(superscript(4096)).toBe('⁴⁰⁹⁶')
  })

  it('marks the 12th-from-the-end conversion as large and builds no animation plan', () => {
    const nfa = kthFromEnd(12)
    const d = derive(nfa)
    const conv = getConversion(nfa, d.subset, true)!
    expect(conv.large).toBe(true)
    expect(conv.plan).toEqual([])
    expect(conv.result.dfa.states).toHaveLength(4096)
  })

  it('small conversions keep their plan', () => {
    const nfa = kthFromEnd(3)
    const conv = getConversion(nfa, subsetConstruction(nfa), true)!
    expect(conv.large).toBe(false)
    expect(conv.plan).toHaveLength(conv.result.steps.length)
  })

  it('never runs dagre for a large DFA', () => {
    const spy = vi.spyOn(dagre, 'layout')
    const dfa = subsetConstruction(kthFromEnd(10)).dfa
    const pos = layoutDFA(dfa)
    expect(spy).not.toHaveBeenCalled()
    expect(Object.keys(pos)).toHaveLength(1024)
    layoutDFA(subsetConstruction(kthFromEnd(3)).dfa)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('grid layout and paging', () => {
    const g = gridLayout(['a', 'b', 'c'], 2, 100)
    expect(g).toEqual({ a: { x: 16, y: 16 }, b: { x: 116, y: 16 }, c: { x: 16, y: 116 } })
    const items = Array.from({ length: 250 }, (_, i) => i)
    expect(pageOf(items, 0).items).toHaveLength(LARGE_TABLE_PAGE)
    expect(pageOf(items, 2)).toMatchObject({ page: 2, pages: 3 })
    expect(pageOf(items, 2).items).toHaveLength(50)
    expect(pageOf(items, 9).page).toBe(2)
    expect(pageOf(items, -3).page).toBe(0)
    expect(pageOf([], 0)).toEqual({ items: [], page: 0, pages: 1 })
  })
})
