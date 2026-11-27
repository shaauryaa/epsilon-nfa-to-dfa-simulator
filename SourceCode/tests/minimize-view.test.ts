import { describe, expect, it } from 'vitest'
import { subsetConstruction } from '../src/core/subset'
import type { DFA } from '../src/core/types'
import {
  BLOCK_COLOR_COUNT,
  blockColor,
  buildMinimizeView,
  canvasState,
  distinguishingWord,
  equivalenceLine,
  minimizedEquivalence,
  minStateLabel,
  partitionText,
  setText,
  planMinimize,
  showWord,
} from '../src/model/minimizeView'
import { chooseSplit } from '../src/model/viewport'
import { getPreset } from '../src/presets'
import { kthFromEnd } from './helpers'

const abb = () => subsetConstruction(getPreset('thompson-abb')!.nfa).dfa

function dfa(partial: Partial<DFA> & Pick<DFA, 'states' | 'transitions'>): DFA {
  return { alphabet: ['a', 'b'], start: partial.states[0], finals: [], subsets: {}, deadState: null, ...partial }
}

describe('buildMinimizeView on (a|b)*abb', () => {
  const view = buildMinimizeView(abb())
  const rounds = view.steps.filter((s) => s.kind === 'round' || s.kind === 'stable')

  it('orders the steps −1, completion, rounds 0–2, the stable round 3 and the result', () => {
    expect(view.steps.map((s) => s.kind)).toEqual(['unreachable', 'complete', 'round', 'round', 'round', 'stable', 'done'])
    expect(view.steps.map((s) => s.pill)).toEqual(['−1', '∅', 'R0', 'R1', 'R2', 'R3', 'Done'])
    expect(view.steps.map((s) => s.round)).toEqual([-1, null, 0, 1, 2, 3, null])
  })

  it('removes nothing and needs no dead state', () => {
    expect(view.removed).toEqual([])
    expect(view.addedDead).toBeNull()
    expect(view.steps[0].text).toBe('Every state can be reached from the start state A, so none is removed.')
    expect(view.steps[0].sublabel).toBe('none')
    expect(view.steps[1].text).toBe('The DFA is complete: every state has a move on every symbol, so no dead state is needed.')
  })

  it('starts with {E} final and {A,B,C,D} non-final', () => {
    expect(rounds[0].blocks).toEqual([['A', 'B', 'C', 'D'], ['E']])
    expect(rounds[0].text).toContain('final {E} | non-final {A,B,C,D}')
    expect(partitionText(rounds[0].blocks!)).toBe('{A,B,C,D} {E}')
  })

  it('round 1 splits D off on b, naming the final and non-final blocks', () => {
    const [split] = rounds[1].splits
    expect(split.symbols).toEqual(['b'])
    expect(split.text).toBe('{A,B,C,D} splits on b: D → E (final block), A, B, C stay in the non-final block.')
    expect(split.moved).toEqual(['D'])
    expect(split.witness).toEqual({ word: ['b'], accepting: 'D', rejecting: 'A' })
    expect(split.edges).toEqual([
      { from: 'A', symbol: 'b', to: 'C' },
      { from: 'B', symbol: 'b', to: 'D' },
      { from: 'C', symbol: 'b', to: 'C' },
      { from: 'D', symbol: 'b', to: 'E' },
    ])
    expect(rounds[1].blocks).toEqual([['A', 'B', 'C'], ['D'], ['E']])
  })

  it('round 2 splits B off on b, with witness bb', () => {
    const [split] = rounds[2].splits
    expect(split.text).toBe('{A,B,C} splits on b: B → D (block {D}), A, C stay in {A,B,C}.')
    expect(split.moved).toEqual(['B'])
    expect(split.witness).toEqual({ word: ['b', 'b'], accepting: 'B', rejecting: 'A' })
    expect(showWord(split.witness!.word, ['a', 'b'])).toBe('bb')
  })

  it('round 3 is stable: {A,C}, B, D, E = 4 states', () => {
    expect(rounds[3].kind).toBe('stable')
    expect(rounds[3].splits).toEqual([])
    expect(rounds[3].text).toContain('The partition is stable: {A,C}, B, D, E = 4 states.')
  })

  it('reports the merge, the counts and equivalence', () => {
    expect(view.alreadyMinimal).toBe(false)
    expect(view.merged).toEqual([{ group: ['A', 'C'], name: '{A,C}' }])
    const done = view.steps[view.steps.length - 1]
    expect(done.text).toBe('A, C merge into {A,C}. The minimal DFA has 4 states, down from 5.')
    expect(done.sublabel).toBe('5 → 4')
    const eq = minimizedEquivalence(view, 8)
    expect(eq.agree).toBe(true)
    expect(equivalenceLine(eq, 8, ['a', 'b'])).toBe('Equivalent: the DFA and the minimal DFA agree on all 511 strings up to length 8.')
  })

  it('keeps block colours stable across rounds', () => {
    const colourOf = (stepIndex: number, member: string) => {
      const s = view.steps[stepIndex]
      return s.colors[s.blocks!.findIndex((b) => b.includes(member))]
    }
    // {A,B,C,D} keeps its colour as {A,B,C} and then {A,C}; E never changes; D and B get new colours.
    expect(colourOf(2, 'A')).toBe(colourOf(3, 'A'))
    expect(colourOf(3, 'A')).toBe(colourOf(4, 'A'))
    expect(colourOf(2, 'E')).toBe(colourOf(4, 'E'))
    const final = view.steps[4].colors
    expect(new Set(final).size).toBe(4)
    expect(view.minColors).toEqual({ '{A,C}': colourOf(4, 'A'), B: colourOf(4, 'B'), D: colourOf(4, 'D'), E: colourOf(4, 'E') })
  })

  it('plans a witness frame and a split frame for rounds that split', () => {
    const plan = planMinimize(view)
    expect(plan.map((f) => f.map((x) => x.phase).join('+'))).toEqual(['show', 'show', 'show', 'witness+split', 'witness+split', 'show', 'show'])
  })

  it('shows the old colours during the witness and the new ones after the split', () => {
    const witness = canvasState(view, 3, 'witness')
    const split = canvasState(view, 3, 'split')
    expect(witness.colorOf.D).toBe(witness.colorOf.A)
    expect(split.colorOf.D).not.toBe(split.colorOf.A)
    expect(witness.ringed).toEqual(['A', 'B', 'C', 'D'])
    expect(witness.edges).toHaveLength(4)
    expect(witness.moved).toEqual([])
    expect(split.moved).toEqual(['D'])
    expect(canvasState(view, 0, 'show').colorOf).toEqual({})
  })
})

describe('buildMinimizeView edge cases', () => {
  it('removes unreachable states in round −1 and fades them on the canvas', () => {
    const input = dfa({
      states: ['A', 'B', 'X'],
      finals: ['B'],
      transitions: { A: { a: 'B', b: 'A' }, B: { a: 'B', b: 'A' }, X: { a: 'B', b: 'X' } },
    })
    const view = buildMinimizeView(input)
    expect(view.removed).toEqual(['X'])
    expect(view.steps[0].text).toBe('X cannot be reached from the start state A, so it is removed: no input string ever visits it.')
    expect(view.steps[0].sublabel).toBe('−1')
    const c = canvasState(view, 0, 'show')
    expect(c.visible).toEqual(['A', 'B', 'X'])
    expect(c.faded).toEqual(['X'])
    expect(canvasState(view, 1, 'show').visible).toEqual(['A', 'B'])
    expect(view.alreadyMinimal).toBe(true)
    expect(view.steps.at(-1)!.text).toBe('Already minimal: no two states are equivalent, so nothing merges. The minimal DFA has 2 states (X was removed as unreachable).')
  })

  it('adds a dead state to a partial DFA and explains why', () => {
    const partial = subsetConstruction(getPreset('thompson-abb')!.nfa, { includeDeadState: false }).dfa
    const nfa = getPreset('dead-state')!.nfa
    const p = subsetConstruction(nfa, { includeDeadState: false }).dfa
    const view = buildMinimizeView(p)
    expect(view.addedDead).not.toBeNull()
    const text = view.steps[1].text
    expect(text).toMatch(/^The DFA is partial: \d+ moves? (is|are) missing \(e\.g\. \S+ on \S+\)\. Dead state ∅ is added/)
    expect(text).toContain('because refinement compares where each state goes on every symbol')
    expect(view.steps[1].sublabel).toBe('+ dead')
    expect(view.work.states).toContain(view.addedDead)
    expect(canvasState(view, 1, 'show').entering).toBe(view.addedDead)
    expect(minimizedEquivalence(view).agree).toBe(true)
    // The textbook DFA has no missing moves, so hiding ∅ changes nothing there.
    expect(buildMinimizeView(partial).addedDead).toBeNull()
  })

  it('says "Already minimal" for the 2³ third-from-end DFA', () => {
    const view = buildMinimizeView(subsetConstruction(getPreset('third-from-end')!.nfa).dfa)
    expect(view.alreadyMinimal).toBe(true)
    expect(view.merged).toEqual([])
    expect(view.result.dfa.states).toHaveLength(8)
    expect(view.steps.at(-1)!.title).toBe('Already minimal')
  })

  it('explains a split that needs two symbols', () => {
    // A, B, C are non-final; A and B differ on a, A and C differ on b, so one round splits {A,B,C} three ways.
    const input = dfa({
      states: ['A', 'B', 'C', 'F'],
      finals: ['F'],
      transitions: { A: { a: 'B', b: 'C' }, B: { a: 'F', b: 'A' }, C: { a: 'A', b: 'F' }, F: { a: 'F', b: 'F' } },
    })
    const view = buildMinimizeView(input)
    const split = view.steps.find((s) => s.round === 1)!.splits[0]
    expect(split.into).toHaveLength(3)
    expect(split.symbols).toEqual(['a', 'b'])
    expect(split.text.startsWith('{A,B,C} splits on a and b: on a, B → F (final block), A, C stay in the non-final block; on b, C → F (final block), A, B stay in the non-final block.')).toBe(true)
    expect(split.moved).toEqual(['B', 'C'])
  })

  it('handles a DFA with no final states', () => {
    const view = buildMinimizeView(dfa({ states: ['A', 'B'], transitions: { A: { a: 'B', b: 'A' }, B: { a: 'A', b: 'B' } } }))
    expect(view.steps.find((s) => s.round === 0)!.text).toContain('no final states')
    expect(view.result.dfa.states).toEqual(['{A,B}'])
  })

  it('marks DFAs over 60 states as large and skips witness strings', () => {
    const big = subsetConstruction(kthFromEnd(7)).dfa
    expect(big.states.length).toBe(128)
    const view = buildMinimizeView(big)
    expect(view.large).toBe(true)
    expect(view.steps.flatMap((s) => s.splits).every((sp) => sp.witness === null)).toBe(true)
    expect(planMinimize(view).every((f) => f.length === 1)).toBe(true)
    expect(view.alreadyMinimal).toBe(true)
    // Long sets are shortened so explanations stay readable.
    expect(view.steps.every((st) => st.text.length < 800)).toBe(true)
    expect(view.steps.find((st) => st.round === 1)!.text).toMatch(/^\{A,B,C,D,… 64 states\} splits on a: /)
  })
})

describe('helpers', () => {
  it('finds the shortest distinguishing word, or null for equivalent states', () => {
    const d = abb()
    expect(distinguishingWord(d, 'A', 'C')).toBeNull()
    expect(distinguishingWord(d, 'A', 'E')).toEqual([])
    expect(distinguishingWord(d, 'A', 'B')).toEqual(['b', 'b'])
  })

  it('shows words with spaces only for multi-character symbols', () => {
    expect(showWord([], ['a'])).toBe('ε')
    expect(showWord(['ab', 'c'], ['ab', 'c'])).toBe('ab c')
  })

  it('shortens long minimal state names', () => {
    expect(minStateLabel('{A,C}')).toEqual({ label: '{A,C}', caption: undefined })
    expect(minStateLabel('{A,B,C,D}')).toEqual({ label: 'A+', caption: '{A,B,C,D}' })
  })

  it('shortens long sets only when asked', () => {
    const xs = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    expect(setText(xs)).toBe('{A,B,C,D,E,F,G}')
    expect(setText(xs, true)).toBe('{A,B,C,D,… 7 states}')
    expect(setText(['A', 'B'], true)).toBe('{A,B}')
  })

  it('wraps block colours and truncates long partitions', () => {
    expect(blockColor(BLOCK_COLOR_COUNT)).toEqual(blockColor(0))
    expect(partitionText([['A'], ['B'], ['C']], 2)).toBe('{A} {B} … and 1 more')
  })
})

describe('chooseSplit', () => {
  const wide = { x: 0, y: 0, width: 800, height: 240 }
  it('stacks two wide, flat graphs on a laptop-sized canvas', () => {
    expect(chooseSplit(wide, wide, 938, 620)).toBe('rows')
  })
  it('puts two tall graphs side by side', () => {
    const tall = { x: 0, y: 0, width: 200, height: 600 }
    expect(chooseSplit(tall, tall, 938, 620)).toBe('cols')
  })
  it('falls back to side by side when a size is unknown', () => {
    expect(chooseSplit(null, wide, 938, 620)).toBe('cols')
    expect(chooseSplit(wide, wide, 0, 0)).toBe('cols')
  })
})
