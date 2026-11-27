import { describe, expect, it } from 'vitest'
import { dfaToENFA, subsetConstruction } from '../src/core'
import { NODE_SIZE, type XY } from '../src/graph/layout'
import { labelHalfWidth, routeAll, type Rect } from '../src/graph/routing'
import { captionRects, dfaCaptions, layoutDFA } from '../src/model/dfaLayout'
import { mergedEdges } from '../src/model/graph'
import { automatonSVG } from '../src/model/svg'
import { presets } from '../src/presets'

/** Points along an SVG path made of one M and one Q or C segment. */
function samplePath(d: string, n = 60): XY[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const pts: XY[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    if (d.includes('Q')) {
      const [x0, y0, cx, cy, x1, y1] = nums
      pts.push({ x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 })
    } else {
      const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = nums
      pts.push({
        x: u ** 3 * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x1,
        y: u ** 3 * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y1,
      })
    }
  }
  return pts
}

const inside = (p: XY, r: Rect) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('DFA captions are kept clear of edges', () => {
  for (const preset of presets) {
    for (const dead of [true, false]) {
      it(`${preset.id}${dead ? '' : ' (no dead state)'}: no edge line or label crosses a caption`, () => {
        const dfa = subsetConstruction(preset.nfa, { includeDeadState: dead }).dfa
        const layout = layoutDFA(dfa)
        const captions = dfaCaptions(dfa)
        const boxes = captionRects(layout, captions)
        const centres = new Map<string, XY>(dfa.states.map((s) => [s, { x: layout[s].x + NODE_SIZE / 2, y: layout[s].y + NODE_SIZE / 2 }]))
        const edges = mergedEdges(dfaToENFA(dfa))
        const routes = routeAll(edges, centres, NODE_SIZE / 2, boxes)
        for (const e of edges) {
          const r = routes.get(e.id)!
          for (const p of samplePath(r.path)) for (const b of boxes) expect(inside(p, b), `${e.id} crosses a caption`).toBe(false)
          const hw = labelHalfWidth(e.label)
          const pill = { x: r.labelX - hw, y: r.labelY - 11, width: hw * 2, height: 22 }
          for (const b of boxes) expect(overlaps(pill, b), `label of ${e.id} covers a caption`).toBe(false)
        }
        // Captions do not overlap each other or other circles.
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false)
      })
    }
  }

  it('the SVG export draws each caption on an opaque box', () => {
    const dfa = subsetConstruction(presets[0].nfa).dfa
    const svg = automatonSVG({ machine: dfaToENFA(dfa), positions: layoutDFA(dfa), captions: dfaCaptions(dfa) }).svg
    expect(svg.match(/<rect [^>]*rx="4" fill="#ffffff"\/>/g)).toHaveLength(dfa.states.length)
  })
})
