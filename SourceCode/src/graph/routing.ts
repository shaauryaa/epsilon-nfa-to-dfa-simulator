/**
 * Edge geometry for automaton graphs: trims edges to the state circles,
 * bends edges around other states, draws self-loops, keeps an ε-edge apart
 * from a symbol edge between the same states, and places labels where they
 * do not cover a state.
 */

import type { XY } from './layout'

/** A routed edge: an SVG path plus where to put its label. */
export interface Route {
  path: string
  labelX: number
  labelY: number
}

/** An axis-aligned rectangle (top-left corner and size), e.g. a caption box. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
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
  /**
   * Which of two parallel edges between the same states this is: `0` for the
   * only edge, `1` for the symbol edge of a pair, `2` for the ε-edge of a
   * pair. Lanes 1 and 2 bend to opposite sides (a lane-2 self-loop hangs
   * below the state instead of above it).
   */
  lane?: 0 | 1 | 2
  /**
   * Boxes neither the edge line nor its label may cross, such as the subset
   * captions under DFA states.
   */
  blocks?: readonly Rect[]
  /**
   * Boxes the edge avoids when it can, such as the label pills of edges
   * routed earlier. A bend that clears them is preferred, but clearing
   * `blocks` always comes first.
   */
  softBlocks?: readonly Rect[]
  /** Points along the lines of edges routed earlier; the label slides along the edge to keep off them when it can. */
  softLines?: readonly XY[]
  /** Half the width of the edge's label pill, in px (default 16). */
  labelHalfWidth?: number
}

/** Half the height of a label pill, in px. */
const LABEL_HALF_HEIGHT = 11
/** Space kept between an edge line and a blocked box, in px. */
const BLOCK_CLEARANCE = 4

const inRect = (p: XY, b: Rect, pad: number) =>
  p.x > b.x - pad && p.x < b.x + b.width + pad && p.y > b.y - pad && p.y < b.y + b.height + pad

/** Signed gap between a label pill centred at `p` and a box (negative = overlap). */
function rectGap(p: XY, hw: number, b: Rect): number {
  const gx = Math.max(b.x - (p.x + hw), p.x - hw - (b.x + b.width))
  const gy = Math.max(b.y - (p.y + LABEL_HALF_HEIGHT), p.y - LABEL_HALF_HEIGHT - (b.y + b.height))
  return Math.max(gx, gy)
}

/** Signed gap between a label pill centred at `p` and the nearest of some line points (negative = a line crosses the pill). */
function lineGap(p: XY, hw: number, lines: readonly XY[]): number {
  let gap = Infinity
  for (const q of lines) gap = Math.min(gap, Math.max(Math.abs(q.x - p.x) - hw, Math.abs(q.y - p.y) - LABEL_HALF_HEIGHT) - 2)
  return gap
}

const CLEARANCE = 10
/** Labels keep at least this far from any state's centre, beyond its radius. */
const LABEL_CLEARANCE = 14

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

function candidateOffsets(hasReverse: boolean, lane: 0 | 1 | 2): number[] {
  if (!hasReverse) {
    if (lane === 1) return [-26, -56, -90, -140, -200]
    if (lane === 2) return [26, 56, 90, 140, 200]
    return [0, 48, -48, 90, -90, 140, -140, 200, -200]
  }
  if (lane === 1) return [24, 50, 90, 130, 180]
  if (lane === 2) return [64, 100, 140, 190, 240]
  return [28, 56, 90, 130, 180]
}

/**
 * Extra bends tried only when none of the usual ones clears every caption:
 * wider bends on the edge's own side, then the opposite side with a larger
 * bend than any partner edge uses, so a reverse pair still reads as two
 * separate arcs.
 */
function fallbackOffsets(hasReverse: boolean, lane: 0 | 1 | 2): number[] {
  if (!hasReverse) {
    if (lane === 1) return [-260, -320, 40, 90, 140]
    if (lane === 2) return [260, 320, -40, -90, -140]
    return [260, -260, 320, -320]
  }
  return [240, 300, -110, -150, -200, -260]
}

/**
 * Picks the point along a quadratic curve for a label: the middle if it is
 * clear of every state and blocked box, otherwise the nearest position along
 * the edge that is, so a label never sits on a state circle or a caption.
 */
function placeLabel(start: XY, c: XY, end: XY, states: readonly XY[], r: number, blocks: readonly Rect[], hw: number, lines: readonly XY[] = []): XY {
  const ts = [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8]
  let best = quadPoint(start, c, end, 0.5)
  let bestGap = -Infinity
  for (const t of ts) {
    const p = quadPoint(start, c, end, t)
    const gap = Math.min(
      ...states.map((o) => Math.hypot(p.x - o.x, p.y - o.y) - r - LABEL_CLEARANCE),
      ...blocks.map((b) => rectGap(p, hw, b) - 2),
      lineGap(p, hw, lines),
    )
    if (gap >= 0) return p
    if (gap > bestGap) {
      bestGap = gap
      best = p
    }
  }
  return best
}

/**
 * Routes one edge.
 *
 * A self-loop is a cubic arc above the state (below it for lane 2). Other
 * edges are quadratic curves whose bend is the smallest offset that keeps
 * the curve clear of every other state; an edge with a reverse partner
 * always bends so the two directions do not overlap (the normal flips with
 * direction, so both bend to their own side), and the two lanes of a
 * symbol/ε pair bend apart. The label sits at the curve's middle, or slides
 * along the curve until it clears every state circle.
 *
 * @param input - See {@link RouteInput}.
 * @returns The SVG path and label position.
 * @throws Never throws.
 */
export function routeEdge(input: RouteInput): Route {
  const { source: s, target: t, radius: r } = input
  const lane = input.lane ?? 0
  if (input.loop) {
    const dir = lane === 2 ? 1 : -1
    const a1 = (dir * 120 * Math.PI) / 180
    const a2 = (dir * 60 * Math.PI) / 180
    const p1 = { x: s.x + r * Math.cos(a1), y: s.y + r * Math.sin(a1) }
    const p2 = { x: s.x + r * Math.cos(a2), y: s.y + r * Math.sin(a2) }
    const h = r * 1.9 * dir
    const path = `M ${r1(p1.x)} ${r1(p1.y)} C ${r1(p1.x - r * 0.9)} ${r1(p1.y + h)} ${r1(p2.x + r * 0.9)} ${r1(p2.y + h)} ${r1(p2.x)} ${r1(p2.y)}`
    return { path, labelX: r1(s.x), labelY: r1(s.y + dir * r + h * 0.75) }
  }

  const dx = t.x - s.x
  const dy = t.y - s.y
  const len = Math.hypot(dx, dy) || 1
  const normal = { x: -dy / len, y: dx / len }
  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }
  const candidates = candidateOffsets(input.hasReverse, lane)

  const blocks = input.blocks ?? []
  const soft = input.softBlocks ?? []
  /** True when the bend crosses a state, or a box of the given strictness (0 states only, 1 + blocks, 2 + soft blocks). */
  const hits = (offset: number, level: 0 | 1 | 2) => {
    const c = { x: mid.x + normal.x * offset * 2, y: mid.y + normal.y * offset * 2 }
    for (let i = 1; i < 40; i++) {
      const p = quadPoint(s, c, t, i / 40)
      // Points inside the end circles are trimmed away later, so they never count.
      if (Math.hypot(p.x - s.x, p.y - s.y) < r || Math.hypot(p.x - t.x, p.y - t.y) < r) continue
      for (const o of input.obstacles) if (Math.hypot(p.x - o.x, p.y - o.y) < r + CLEARANCE) return true
      if (level >= 1) for (const b of blocks) if (inRect(p, b, BLOCK_CLEARANCE)) return true
      if (level >= 2) for (const b of soft) if (inRect(p, b, BLOCK_CLEARANCE)) return true
    }
    return false
  }
  const fallback = blocks.length + soft.length > 0 ? fallbackOffsets(input.hasReverse, lane) : []
  // Prefer a bend that clears states, captions and earlier labels; then states and captions; then states only.
  const offset =
    candidates.find((o) => !hits(o, 2)) ??
    fallback.find((o) => !hits(o, 2)) ??
    candidates.find((o) => !hits(o, 1)) ??
    fallback.find((o) => !hits(o, 1)) ??
    candidates.find((o) => !hits(o, 0)) ??
    candidates[0]
  // Control point twice the offset away, so the curve's apex sits `offset` from the chord.
  const c = { x: mid.x + normal.x * offset * 2, y: mid.y + normal.y * offset * 2 }
  const start = towards(s, offset === 0 ? t : c, r)
  const end = towards(t, offset === 0 ? s : c, r + 2)
  const label = placeLabel(start, c, end, [s, t, ...input.obstacles], r, [...blocks, ...soft], input.labelHalfWidth ?? 16, input.softLines)
  return {
    path: `M ${r1(start.x)} ${r1(start.y)} Q ${r1(c.x)} ${r1(c.y)} ${r1(end.x)} ${r1(end.y)}`,
    labelX: r1(label.x),
    labelY: r1(label.y),
  }
}

/** Points along a routed path (one `M` and one `Q` or `C` segment). */
function pathPoints(d: string, n = 32): XY[] {
  const v = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const out: XY[] = []
  for (let i = 1; i < n; i++) {
    const t = i / n
    const u = 1 - t
    if (v.length === 6) out.push({ x: u * u * v[0] + 2 * u * t * v[2] + t * t * v[4], y: u * u * v[1] + 2 * u * t * v[3] + t * t * v[5] })
    else if (v.length === 8)
      out.push({
        x: u ** 3 * v[0] + 3 * u * u * t * v[2] + 3 * u * t * t * v[4] + t ** 3 * v[6],
        y: u ** 3 * v[1] + 3 * u * u * t * v[3] + 3 * u * t * t * v[5] + t ** 3 * v[7],
      })
  }
  return out
}

/** The edge fields {@link routeAll} needs (a `MergedEdge` has them all). */
export interface RoutableEdge {
  id: string
  source: string
  target: string
  loop: boolean
  hasReverse: boolean
  hasParallel: boolean
  epsilonOnly: boolean
  /** Label text, used to size the label pill. */
  label?: string
}

/**
 * Half the width of a label pill for some text at the canvas label size.
 *
 * @param label - The label text.
 * @returns Half the pill width in px.
 * @throws Never throws.
 */
export function labelHalfWidth(label: string): number {
  return ([...label].length * 13 * 0.62 + 18) / 2
}

/**
 * Routes every edge around the other states. A symbol edge and an ε-edge
 * between the same states go in separate lanes so they never overlap.
 * Self-loops are routed first, then the other edges in order; each placed
 * label pill becomes a box the later edges (their lines and labels) keep
 * clear of, and each later label slides along its edge to keep off the
 * lines already drawn, so labels stay readable.
 *
 * @param edges - Edges, e.g. from `mergedEdges`.
 * @param centres - Circle centre of each state.
 * @param radius - Circle radius.
 * @param blocks - Boxes edges and labels keep clear of, such as captions.
 * @returns Route per edge id; edges with an unknown end are skipped.
 * @throws Never throws.
 */
export function routeAll(
  edges: readonly RoutableEdge[],
  centres: ReadonlyMap<string, XY>,
  radius: number,
  blocks: readonly Rect[] = [],
): Map<string, Route> {
  const out = new Map<string, Route>()
  const all = [...centres.entries()]
  const placed: Rect[] = []
  const lines: XY[] = []
  // Self-loop labels have a fixed place above their state, so loops go first and the other edges keep clear of them.
  for (const e of [...edges.filter((x) => x.loop), ...edges.filter((x) => !x.loop)]) {
    const source = centres.get(e.source)
    const target = centres.get(e.target)
    if (!source || !target) continue
    const obstacles = all.filter(([id]) => id !== e.source && id !== e.target).map(([, p]) => p)
    const lane = e.hasParallel ? (e.epsilonOnly ? 2 : 1) : 0
    const labelHalf = e.label !== undefined ? labelHalfWidth(e.label) : undefined
    const route = routeEdge({ source, target, loop: e.loop, hasReverse: e.hasReverse, obstacles, radius, lane, blocks, softBlocks: placed, softLines: lines, labelHalfWidth: labelHalf })
    out.set(e.id, route)
    const hw = labelHalf ?? 16
    placed.push({ x: route.labelX - hw, y: route.labelY - LABEL_HALF_HEIGHT, width: hw * 2, height: LABEL_HALF_HEIGHT * 2 })
    lines.push(...pathPoints(route.path))
  }
  return out
}
