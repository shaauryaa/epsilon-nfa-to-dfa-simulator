/**
 * Edge geometry for automaton graphs: trims edges to the state circles,
 * bends edges around other states, and draws self-loops.
 */

import type { XY } from './layout'

/** A routed edge: an SVG path plus where to put its label. */
export interface Route {
  path: string
  labelX: number
  labelY: number
}

/** Input for {@link routeEdge}. Positions are circle centres. */
export interface RouteInput {
  source: XY
  target: XY
  loop: boolean
  hasReverse: boolean
  /** Centres of every other state, to steer around. */
  obstacles: readonly XY[]
  /** Circle radius. */
  radius: number
}

const CLEARANCE = 10

function quadPoint(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

function towards(from: XY, to: XY, distance: number): XY {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: from.x + (dx / len) * distance, y: from.y + (dy / len) * distance }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Routes one edge.
 *
 * A self-loop is a cubic arc above the state. Other edges are quadratic
 * curves whose bend is the smallest offset that keeps the curve clear of
 * every other state; an edge with a reverse partner always bends so the two
 * directions do not overlap (the normal flips with direction, so both bend
 * to their own side).
 *
 * @param input - See {@link RouteInput}.
 * @returns The SVG path and label position.
 * @throws Never throws.
 */
export function routeEdge(input: RouteInput): Route {
  const { source: s, target: t, radius: r } = input
  if (input.loop) {
    const a1 = (-120 * Math.PI) / 180
    const a2 = (-60 * Math.PI) / 180
    const p1 = { x: s.x + r * Math.cos(a1), y: s.y + r * Math.sin(a1) }
    const p2 = { x: s.x + r * Math.cos(a2), y: s.y + r * Math.sin(a2) }
    const h = r * 1.9
    const path = `M ${r1(p1.x)} ${r1(p1.y)} C ${r1(p1.x - r * 0.9)} ${r1(p1.y - h)} ${r1(p2.x + r * 0.9)} ${r1(p2.y - h)} ${r1(p2.x)} ${r1(p2.y)}`
    return { path, labelX: r1(s.x), labelY: r1(s.y - r - h * 0.75) }
  }

  const dx = t.x - s.x
  const dy = t.y - s.y
  const len = Math.hypot(dx, dy) || 1
  const normal = { x: -dy / len, y: dx / len }
  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }
  const candidates = input.hasReverse ? [28, 56, 90, 130, 180] : [0, 48, -48, 90, -90, 140, -140, 200, -200]

  const clear = (offset: number) => {
    const c = { x: mid.x + normal.x * offset * 2, y: mid.y + normal.y * offset * 2 }
    for (let i = 1; i < 20; i++) {
      const p = quadPoint(s, c, t, i / 20)
      for (const o of input.obstacles) if (Math.hypot(p.x - o.x, p.y - o.y) < r + CLEARANCE) return false
    }
    return true
  }
  const offset = candidates.find(clear) ?? candidates[0]
  // Control point twice the offset away, so the curve's apex sits `offset` from the chord.
  const c = { x: mid.x + normal.x * offset * 2, y: mid.y + normal.y * offset * 2 }
  const start = towards(s, offset === 0 ? t : c, r)
  const end = towards(t, offset === 0 ? s : c, r + 2)
  const apex = quadPoint(start, c, end, 0.5)
  return {
    path: `M ${r1(start.x)} ${r1(start.y)} Q ${r1(c.x)} ${r1(c.y)} ${r1(end.x)} ${r1(end.y)}`,
    labelX: r1(apex.x),
    labelY: r1(apex.y),
  }
}
