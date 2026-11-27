import { describe, expect, it } from 'vitest'
import { dfaToENFA, subsetConstruction, type DFA } from '../src/core'
import { minimizeDFA } from '../src/core/minimize'
import { NODE_SIZE, type XY } from '../src/graph/layout'
import { labelHalfWidth, routeAll, type Rect } from '../src/graph/routing'
import { captionRects, dfaCaptions, dfaSpacing, DFA_SPACING, layoutDFA, SMALL_DFA_SPACING } from '../src/model/dfaLayout'
import { mergedEdges } from '../src/model/graph'
import { minStateLabel } from '../src/model/minimizeView'
import { samplePath } from '../src/model/viewport'
import { getPreset, presets } from '../src/presets'

const inside = (p: XY, r: Rect) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

function routed(dfa: DFA, captions: Record<string, string>) {
  const layout = layoutDFA(dfa, captions)
  const centres = new Map<string, XY>(dfa.states.map((s) => [s, { x: layout[s].x + NODE_SIZE / 2, y: layout[s].y + NODE_SIZE / 2 }]))
  const edges = mergedEdges(dfaToENFA(dfa))
  const routes = routeAll(edges, centres, NODE_SIZE / 2, captionRects(layout, captions))
  const pill = (id: string, label: string): Rect => {
    const r = routes.get(id)!
    const hw = labelHalfWidth(label)
    return { x: r.labelX - hw, y: r.labelY - 11, width: hw * 2, height: 22 }
  }
  return { centres, edges, routes, pill }
}

/** Edge pairs where one edge's line runs through the other edge's label pill. */
function lineOverLabel(dfa: DFA, captions: Record<string, string>): string[] {
  const { edges, routes, pill } = routed(dfa, captions)
  const out: string[] = []
  for (const e of edges) {
    const box = pill(e.id, e.label)
    for (const o of edges) {
      if (o.id === e.id) continue
      if (samplePath(routes.get(o.id)!.path, 60).some((p) => inside(p, box))) out.push(`${o.id} over label of ${e.id}`)
    }
  }
  return out
}

/** Labels that overlap another label or sit on a state circle (labels are drawn above every edge line). */
function hiddenLabels(dfa: DFA, captions: Record<string, string>): string[] {
  const { centres, edges, pill } = routed(dfa, captions)
  const out: string[] = []
  const boxes = edges.map((e) => [e.id, pill(e.id, e.label)] as const)
  for (let i = 0; i < boxes.length; i++) {
    const [id, a] = boxes[i]
    for (let j = i + 1; j < boxes.length; j++) if (overlaps(a, boxes[j][1])) out.push(`${id} label overlaps ${boxes[j][0]} label`)
    for (const [s, c] of centres) {
      const nx = Math.max(a.x, Math.min(c.x, a.x + a.width))
      const ny = Math.max(a.y, Math.min(c.y, a.y + a.height))
      if (Math.hypot(nx - c.x, ny - c.y) < NODE_SIZE / 2) out.push(`${id} label on state ${s}`)
    }
  }
  return out
}

const minCaptions = (dfa: DFA) => Object.fromEntries(dfa.states.flatMap((s) => (minStateLabel(s).caption ? [[s, minStateLabel(s).caption!]] : [])))

describe('edge labels stay readable', () => {
  it('(a|b)*abb minimal DFA: no edge line crosses another edge label', () => {
    const dfa = subsetConstruction(getPreset('thompson-abb')!.nfa).dfa
    const min = minimizeDFA(dfa).dfa
    expect(min.states).toHaveLength(4)
    expect(lineOverLabel(min, minCaptions(min))).toEqual([])
  })

  for (const preset of presets) {
    it(`${preset.id}: no DFA or minimal DFA label overlaps another label or a state`, () => {
      const dfa = subsetConstruction(preset.nfa).dfa
      expect(hiddenLabels(dfa, dfaCaptions(dfa))).toEqual([])
      const min = minimizeDFA(dfa).dfa
      expect(hiddenLabels(min, minCaptions(min))).toEqual([])
    })
  }

  it('small DFAs get roomier spacing than larger ones', () => {
    expect(dfaSpacing(4)).toBe(SMALL_DFA_SPACING)
    expect(dfaSpacing(5)).toBe(DFA_SPACING)
    expect(SMALL_DFA_SPACING.ranksep).toBeGreaterThan(DFA_SPACING.ranksep)
  })
})
