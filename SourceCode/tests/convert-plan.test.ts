import { describe, expect, it } from 'vitest'
import { subsetConstruction } from '../src/core'
import { dfaProgress, moveEdges, planAll, planStep, stepPill } from '../src/model/convertPlan'
import { getPreset, presets } from '../src/presets'

const thompson = getPreset('thompson-abb')!.nfa
const result = subsetConstruction(thompson)

describe('planStep', () => {
  it('the start step pulses the start state, spreads the closure edge by edge and reveals A', () => {
    const frames = planStep(thompson, result.steps[0])
    expect(frames[0].phase).toBe('pulse')
    expect(frames[0].current).toEqual(['0'])
    const spread = frames.filter((f) => f.phase === 'closure')
    // ε-closure({0}) = {0,1,2,4,7}: four new states, one per frame.
    expect(spread).toHaveLength(4)
    expect(spread.map((f) => f.closure.length)).toEqual([2, 3, 4, 5])
    const last = frames.at(-1)!
    expect(last.phase).toBe('dfa')
    expect(last.closure).toEqual(['0', '1', '2', '4', '7'])
    expect(last.revealed).toBe(true)
    expect(last.text).toBe(result.steps[0].explanation)
  })

  it('a transition step plays pulse, move, closure, DFA, cell in order', () => {
    const step = result.steps[1] // A on a
    const frames = planStep(thompson, step)
    const phases = frames.map((f) => f.phase)
    expect(phases[0]).toBe('pulse')
    expect(phases[1]).toBe('move')
    expect(phases.at(-2)).toBe('dfa')
    expect(phases.at(-1)).toBe('cell')
    expect(frames[1].tokens).toBe(true)
    expect(frames[1].symbolEdges).toEqual([
      ['2', '3'],
      ['7', '8'],
    ])
    expect(frames[1].moved).toEqual(['3', '8'])
    const end = frames.at(-1)!
    expect(end.closure).toEqual(step.closureSet)
    expect(end.filled).toBe(true)
    expect(end.text).toBe(step.explanation)
    // Earlier frames never claim the cell is filled.
    expect(frames.slice(0, -1).every((f) => !f.filled)).toBe(true)
  })

  it('every step of every preset ends with its full closure and explanation', () => {
    for (const p of presets) {
      const r = subsetConstruction(p.nfa)
      const all = planAll(p.nfa, r)
      expect(all).toHaveLength(r.steps.length)
      all.forEach((frames, i) => {
        const end = frames.at(-1)!
        expect(end.text).toBe(r.steps[i].explanation)
        if (r.steps[i].kind !== 'done') expect(end.closure).toEqual(r.steps[i].closureSet)
        expect(frames.filter((f) => f.phase === 'closure').length).toBeLessThanOrEqual(10)
      })
    }
  })

  it('an empty move says so and has no tokens', () => {
    const step = result.steps.find((s) => s.kind === 'transition' && s.moveSet?.length === 0)
    if (!step) return
    const frames = planStep(thompson, step)
    expect(frames[1].tokens).toBe(false)
    expect(frames[1].text).toMatch(/= ∅/)
  })
})

describe('moveEdges', () => {
  it('lists each symbol edge out of the set', () => {
    expect(moveEdges(thompson, ['0', '1', '2', '4', '7'], 'b')).toEqual([['4', '5']])
  })
})

describe('dfaProgress', () => {
  it('shows only A at the start and every state at the end', () => {
    const first = dfaProgress(result.dfa, result.steps, 0, { revealed: true, filled: true })
    expect(first.states).toEqual(['A'])
    expect(first.entering).toBe('A')
    const last = result.steps.length - 1
    const end = dfaProgress(result.dfa, result.steps, last, { revealed: true, filled: true })
    expect(end.states).toEqual(result.dfa.states)
    expect(end.transitions).toEqual(result.dfa.transitions)
  })

  it('adds the new state and edge only once the frame reveals them', () => {
    const before = dfaProgress(result.dfa, result.steps, 1, { revealed: false, filled: false })
    expect(before.states).toEqual(['A'])
    expect(before.cell).toEqual({ state: 'A', symbol: 'a' })
    expect(before.cellFilled).toBe(false)
    const after = dfaProgress(result.dfa, result.steps, 1, { revealed: true, filled: false })
    expect(after.states).toEqual(['A', 'B'])
    expect(after.entering).toBe('B')
    expect(after.drawing).toEqual({ from: 'A', symbol: 'a', to: 'B' })
    expect(after.transitions.A).toEqual({ a: 'B' })
  })

  it('flashes an existing state instead of adding it again', () => {
    const i = result.steps.findIndex((s) => s.kind === 'transition' && !s.isNew)
    const p = dfaProgress(result.dfa, result.steps, i, { revealed: true, filled: true })
    expect(p.flashing).toBe(result.steps[i].to)
    expect(p.entering).toBeNull()
  })
})

describe('stepPill', () => {
  it('labels start, transitions and done', () => {
    expect(stepPill(result.steps[0])).toEqual({ label: 'START', sublabel: '→ A' })
    expect(stepPill(result.steps[1])).toEqual({ label: 'A·a', sublabel: '→ B' })
    expect(stepPill(result.steps.at(-1)!).label).toBe('DONE')
  })
})
