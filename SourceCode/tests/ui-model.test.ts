import { describe, expect, it } from 'vitest'
import { EPSILON, toText, validateENFA, type ENFA } from '../src/core'
import { layoutLR, NODE_SIZE } from '../src/graph/layout'
import { routeEdge } from '../src/graph/routing'
import { listTransitions, mergedEdges } from '../src/model/graph'
import { findLine, focusKey, focusTargetFor } from '../src/model/issues'
import { getPreset, presets } from '../src/presets'
import { validationCases } from '../src/presets/validation'
import { derive } from '../src/store/derive'

const E = EPSILON
const thompson = getPreset('thompson-abb')!.nfa

describe('mergedEdges', () => {
  it('merges parallel transitions into one labelled edge', () => {
    const nfa: ENFA = {
      states: ['p', 'q'],
      alphabet: ['a', 'b'],
      start: 'p',
      finals: ['q'],
      transitions: { p: { b: ['q'], a: ['q', 'p'], [E]: ['q'] }, q: { [E]: ['p'] } },
    }
    const edges = mergedEdges(nfa)
    expect(edges.map((e) => [e.source, e.target, e.label])).toEqual([
      ['p', 'p', 'a'],
      ['p', 'q', 'a, b, ε'],
      ['q', 'p', 'ε'],
    ])
    const [loop, pq, qp] = edges
    expect(loop.loop).toBe(true)
    expect(pq.epsilonOnly).toBe(false)
    expect(qp.epsilonOnly).toBe(true)
    expect(pq.hasReverse && qp.hasReverse).toBe(true)
  })

  it('skips transitions to undeclared states', () => {
    const nfa: ENFA = { states: ['p'], alphabet: ['a'], start: 'p', finals: [], transitions: { p: { a: ['zz'] } } }
    expect(mergedEdges(nfa)).toEqual([])
  })

  it('draws the Thompson preset with 13 edges, 8 of them ε-only', () => {
    const edges = mergedEdges(thompson)
    expect(edges).toHaveLength(13)
    expect(edges.filter((e) => e.epsilonOnly)).toHaveLength(8)
  })
})

describe('listTransitions', () => {
  it('lists one triple per target, alphabet order then ε', () => {
    const nfa: ENFA = {
      states: ['p', 'q'],
      alphabet: ['a', 'b'],
      start: 'p',
      finals: ['q'],
      transitions: { q: { [E]: ['p'] }, p: { [E]: ['q'], b: ['q'], a: ['p', 'q'] } },
    }
    expect(listTransitions(nfa).map((t) => `${t.from} ${t.symbol} ${t.to}`)).toEqual(['p a p', 'p a q', 'p b q', 'p ε q', 'q ε p'])
  })

  it('counts the Thompson preset: 13 transitions, 8 of them ε', () => {
    const list = listTransitions(thompson)
    expect(list).toHaveLength(13)
    expect(list.filter((t) => t.symbol === E)).toHaveLength(8)
  })

  it('keeps undeclared sources and symbols visible', () => {
    const nfa: ENFA = { states: ['p'], alphabet: ['a'], start: 'p', finals: [], transitions: { zz: { a: ['p'] }, p: { c: ['p'] } } }
    expect(listTransitions(nfa)).toEqual([
      { from: 'p', symbol: 'c', to: 'p' },
      { from: 'zz', symbol: 'a', to: 'p' },
    ])
  })
})

describe('layoutLR', () => {
  it('places every state, start at the far left, final at the far right', () => {
    const pos = layoutLR(thompson.states, mergedEdges(thompson))
    expect(Object.keys(pos)).toEqual(thompson.states)
    const xs = thompson.states.map((s) => pos[s].x)
    expect(pos['0'].x).toBe(Math.min(...xs))
    expect(pos['10'].x).toBe(Math.max(...xs))
  })
})

describe('routeEdge', () => {
  const r = NODE_SIZE / 2
  it('draws a straight edge trimmed to both circles when the way is clear', () => {
    const route = routeEdge({ source: { x: 0, y: 0 }, target: { x: 200, y: 0 }, loop: false, hasReverse: false, obstacles: [], radius: r })
    expect(route.path).toBe(`M ${r} 0 Q 100 0 ${200 - r - 2} 0`)
  })

  it('bends around a state in the way', () => {
    const route = routeEdge({
      source: { x: 0, y: 0 },
      target: { x: 300, y: 0 },
      loop: false,
      hasReverse: false,
      obstacles: [{ x: 150, y: 0 }],
      radius: r,
    })
    expect(Math.abs(route.labelY)).toBeGreaterThan(r)
  })

  it('bends a pair of opposite edges to opposite sides', () => {
    const a = routeEdge({ source: { x: 0, y: 0 }, target: { x: 200, y: 0 }, loop: false, hasReverse: true, obstacles: [], radius: r })
    const b = routeEdge({ source: { x: 200, y: 0 }, target: { x: 0, y: 0 }, loop: false, hasReverse: true, obstacles: [], radius: r })
    expect(Math.sign(a.labelY)).toBe(-Math.sign(b.labelY))
  })

  it('draws a self-loop above the state', () => {
    const route = routeEdge({ source: { x: 50, y: 50 }, target: { x: 50, y: 50 }, loop: true, hasReverse: false, obstacles: [], radius: r })
    expect(route.path.startsWith('M ')).toBe(true)
    expect(route.path).toContain(' C ')
    expect(route.labelY).toBeLessThan(50 - r)
  })
})

describe('focusTargetFor', () => {
  it('maps every validation case to a target', () => {
    for (const c of validationCases) {
      const issues = [...validateENFA(c.nfa).errors, ...validateENFA(c.nfa).warnings].filter((i) => i.code === c.code)
      expect(issues.length).toBeGreaterThan(0)
      for (const issue of issues) expect(focusTargetFor(issue, c.nfa, toText(c.nfa)).kind).toBeTruthy()
    }
  })

  it('points an unknown target at its table cell', () => {
    const c = validationCases.find((v) => v.code === 'UNKNOWN_TARGET_STATE')!
    const issue = validateENFA(c.nfa).errors[0]
    expect(focusTargetFor(issue, c.nfa, toText(c.nfa))).toEqual({ kind: 'cell', row: 0, symbol: 'a' })
  })

  it('points an undeclared source at its text line', () => {
    const c = validationCases.find((v) => v.code === 'UNKNOWN_SOURCE_STATE')!
    const text = toText(c.nfa)
    const issue = validateENFA(c.nfa).errors.find((e) => e.code === 'UNKNOWN_SOURCE_STATE')!
    const target = focusTargetFor(issue, c.nfa, text)
    expect(target.kind).toBe('text')
    if (target.kind === 'text') expect(text.split('\n')[target.line - 1]).toMatch(/^q9 a ->/)
  })

  it('points start and final problems at their builder controls', () => {
    for (const code of ['NO_START', 'NO_FINALS'] as const) {
      const c = validationCases.find((v) => v.code === code)!
      const v = validateENFA(c.nfa)
      const issue = [...v.errors, ...v.warnings].find((i) => i.code === code)!
      const target = focusTargetFor(issue, c.nfa, toText(c.nfa))
      expect(focusKey(target)).toBe(code === 'NO_START' ? 'start' : 'final')
    }
  })

  it('findLine ignores comments and defaults to line 1', () => {
    expect(findLine('a\n# final: x\nfinal: q1', (l) => l.startsWith('final'))).toBe(3)
    expect(findLine('a', () => false)).toBe(1)
  })
})

describe('derive', () => {
  it('computes every result for each preset', () => {
    for (const p of presets) {
      const d = derive(p.nfa)
      expect(d.validation.errors).toEqual([])
      expect(d.closures && Object.keys(d.closures)).toEqual(p.nfa.states)
      if (p.expectedDfaStates !== undefined) expect(d.subset?.dfa.states).toHaveLength(p.expectedDfaStates)
      expect(d.minimized).not.toBeNull()
      expect(d.error).toBeNull()
    }
  })

  it('skips the algorithms while the machine has errors', () => {
    const c = validationCases.find((v) => v.code === 'NO_START')!
    const d = derive(c.nfa)
    expect(d.validation.errors.length).toBeGreaterThan(0)
    expect(d.subset).toBeNull()
    expect(d.closures).toBeNull()
    expect(d.minimized).toBeNull()
  })
})
