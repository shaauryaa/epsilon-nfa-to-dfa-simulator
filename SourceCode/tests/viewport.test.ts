import { describe, expect, it } from 'vitest'
import { layoutLR, NODE_SIZE } from '../src/graph/layout'
import { mergedEdges } from '../src/model/graph'
import { drawingBounds, FIT_MAX_ZOOM, FIT_MIN_ZOOM, fitViewport, panTarget, READABLE_ZOOM, TOP_INSET } from '../src/model/viewport'
import { getPreset } from '../src/presets'

const thompson = getPreset('thompson-abb')!.nfa
const box = drawingBounds({ positions: Object.values(layoutLR(thompson.states, mergedEdges(thompson))) })!

/** Screen box of a graph box under a viewport. */
const onScreen = (b: typeof box, v: { x: number; y: number; zoom: number }) => ({
  left: b.x * v.zoom + v.x,
  right: (b.x + b.width) * v.zoom + v.x,
  top: b.y * v.zoom + v.y,
  bottom: (b.y + b.height) * v.zoom + v.y,
})

describe('fitViewport', () => {
  it('Fit ("whole") shows the 11-state Thompson machine inside a 1366×768 half pane', () => {
    const w = 469
    const h = 560
    const v = fitViewport(box, w, h, 'whole')
    expect(v.zoom).toBeLessThan(READABLE_ZOOM)
    expect(v.zoom).toBeGreaterThanOrEqual(FIT_MIN_ZOOM)
    const s = onScreen(box, v)
    expect(s.left).toBeGreaterThanOrEqual(0)
    expect(s.right).toBeLessThanOrEqual(w)
    expect(s.top).toBeGreaterThanOrEqual(TOP_INSET)
    expect(s.bottom).toBeLessThanOrEqual(h)
  })

  it('the automatic view keeps the readable floor and starts at the left', () => {
    const v = fitViewport(box, 469, 560, 'readable')
    expect(v.zoom).toBeCloseTo(READABLE_ZOOM)
    expect(onScreen(box, v).left).toBeCloseTo(16)
  })

  it('small graphs scale up to use the pane, but not past the maximum', () => {
    const small = { x: 0, y: 0, width: 200, height: 60 }
    const v = fitViewport(small, 958, 958, 'readable')
    expect(v.zoom).toBe(FIT_MAX_ZOOM)
    const s = onScreen(small, v)
    expect((s.left + s.right) / 2).toBeCloseTo(958 / 2)
  })

  it('never goes below the Fit floor, even for a huge graph', () => {
    expect(fitViewport({ x: 0, y: 0, width: 20000, height: 100 }, 400, 400, 'whole').zoom).toBe(FIT_MIN_ZOOM)
  })
})

describe('drawingBounds', () => {
  it('includes the start arrow, captions, paths and labels', () => {
    const b = drawingBounds({
      positions: [{ x: 0, y: 0 }],
      start: { x: 0, y: 0 },
      captions: [{ x: -40, y: 62, width: 136, height: 20 }],
      paths: ['M 10 10 Q 300 -200 20 20', 'M 0 0 L 300 0'],
      labels: [{ x: 0, y: -260, halfWidth: 10 }],
    })!
    expect(b.x).toBe(-50)
    expect(b.y).toBe(-272)
    expect(b.x + b.width).toBe(300)
    expect(b.y + b.height).toBe(82)
    expect(drawingBounds({ positions: [] })).toBeNull()
  })
})

describe('panTarget', () => {
  const view = { x: 0, y: 0, zoom: 1 }
  it('does not move when the box is already in view', () => {
    expect(panTarget(view, 800, 600, { x: 100, y: 100, width: NODE_SIZE, height: NODE_SIZE })).toBeNull()
  })

  it('pans just enough to bring an off-screen box into view', () => {
    const b = { x: 1000, y: 200, width: NODE_SIZE, height: NODE_SIZE }
    const c = panTarget(view, 800, 600, b)!
    expect(c).not.toBeNull()
    // Centre the view at c: the box's right edge must land inside the pane.
    const nv = { zoom: 1, x: 800 / 2 - c.x, y: (600 + TOP_INSET) / 2 - c.y }
    const s = onScreen(b, nv)
    expect(s.right).toBeLessThanOrEqual(800 - 24 + 0.001)
    expect(s.left).toBeGreaterThanOrEqual(0)
  })

  it('centres a box larger than the pane', () => {
    const b = { x: 0, y: 0, width: 2000, height: 50 }
    const c = panTarget(view, 800, 600, b)!
    expect(c.x).toBe(1000)
  })
})
