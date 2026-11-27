/**
 * Viewport arithmetic for the graph canvases: the box a drawing occupies,
 * the zoom and offset that fit it into a pane, and the pan that brings a
 * group of states into view during playback. Pure functions, so the rules
 * are unit tested without a browser.
 */

import { NODE_SIZE, type XY } from '../graph/layout'
import type { Rect } from '../graph/routing'

/** A React Flow style viewport: screen = graph × zoom + (x, y). */
export interface Viewport {
  x: number
  y: number
  zoom: number
}

/**
 * Lowest zoom the automatic initial view uses: edge labels (13px) never
 * render below 12px. Bigger machines start at this zoom, aligned left.
 */
export const READABLE_ZOOM = 12 / 13
/** Lowest zoom the Fit button may use so the whole graph shows. */
export const FIT_MIN_ZOOM = 0.45
/** Highest zoom any fit uses; small graphs scale up to fill the pane. */
export const FIT_MAX_ZOOM = 1.5
/** Space kept clear at the top of a pane for its title and toolbar, in px. */
export const TOP_INSET = 56
/** Margin kept inside the pane on every side when fitting, in px. */
export const FIT_MARGIN = 16

/**
 * Points along an edge path of the form `M x y Q cx cy x y` or
 * `M x y C c1x c1y c2x c2y x y` (what the router produces). Any other path
 * falls back to its listed coordinates.
 *
 * @param d - SVG path data.
 * @param n - Number of segments to sample (default 24).
 * @returns Points on the curve, ends included.
 * @throws Never throws.
 */
export function samplePath(d: string, n = 24): XY[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const pts: XY[] = []
  const quad = /Q/.test(d) && nums.length === 6
  const cubic = /C/.test(d) && nums.length === 8
  if (!quad && !cubic) {
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] })
    return pts
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    if (quad) {
      const [x0, y0, cx, cy, x1, y1] = nums
      pts.push({ x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 })
    } else {
      const [x0, y0, ax, ay, bx, by, x1, y1] = nums
      pts.push({
        x: u ** 3 * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * x1,
        y: u ** 3 * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * y1,
      })
    }
  }
  return pts
}

/** What to include when measuring a drawing. */
export interface DrawingParts {
  /** Top-left of each state circle. */
  positions: readonly XY[]
  /** The start state's top-left, for its incoming arrow on the left. */
  start?: XY | null
  /** Caption boxes under states. */
  captions?: readonly Rect[]
  /** Edge SVG paths (`M … Q …` or `M … C …`); the curves themselves are measured, not their control points. */
  paths?: readonly string[]
  /** Edge label centres with their half widths. */
  labels?: readonly { x: number; y: number; halfWidth: number }[]
}

/**
 * Measures the box a drawing occupies in graph coordinates: circles, the
 * start arrow, captions, every edge path point and every label pill.
 *
 * @param parts - See {@link DrawingParts}.
 * @returns The bounding box, or `null` when there is nothing to measure.
 * @throws Never throws.
 */
export function drawingBounds(parts: DrawingParts): Rect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const p of parts.positions) {
    grow(p.x, p.y)
    grow(p.x + NODE_SIZE, p.y + NODE_SIZE)
  }
  if (parts.start) grow(parts.start.x - 50, parts.start.y + NODE_SIZE / 2 - 14)
  for (const c of parts.captions ?? []) {
    grow(c.x, c.y)
    grow(c.x + c.width, c.y + c.height)
  }
  for (const d of parts.paths ?? []) for (const p of samplePath(d)) grow(p.x, p.y)
  for (const l of parts.labels ?? []) {
    grow(l.x - l.halfWidth, l.y - 12)
    grow(l.x + l.halfWidth, l.y + 12)
  }
  if (minX === Infinity) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** How a fit treats graphs that do not fit at a readable zoom. */
export type FitMode = 'readable' | 'whole'

/**
 * Computes the viewport that fits a drawing into a pane.
 *
 * - `whole` (the Fit button): the whole drawing always fits, zooming out as
 *   far as {@link FIT_MIN_ZOOM} and in as far as {@link FIT_MAX_ZOOM}.
 * - `readable` (the automatic initial view): the same, but never below
 *   {@link READABLE_ZOOM}; a drawing that would need to shrink further
 *   starts at the left edge (where the start state is) and the user pans.
 *
 * The drawing is centred in the pane area below {@link TOP_INSET} when it
 * fits.
 *
 * @param box - The drawing's bounds from {@link drawingBounds}.
 * @param width - Pane width in px.
 * @param height - Pane height in px.
 * @param mode - See {@link FitMode}.
 * @returns The viewport.
 * @throws Never throws; a zero-sized pane gives the minimum zoom.
 */
export function fitViewport(box: Rect, width: number, height: number, mode: FitMode): Viewport {
  const w = Math.max(1, width - 2 * FIT_MARGIN)
  const h = Math.max(1, height - TOP_INSET - FIT_MARGIN)
  const bw = Math.max(1, box.width)
  const bh = Math.max(1, box.height)
  const floor = mode === 'whole' ? FIT_MIN_ZOOM : READABLE_ZOOM
  const zoom = Math.max(floor, Math.min(FIT_MAX_ZOOM, w / bw, h / bh))
  const cw = bw * zoom
  const ch = bh * zoom
  const x = FIT_MARGIN + (cw <= w ? (w - cw) / 2 : 0) - box.x * zoom
  const y = TOP_INSET + (ch <= h ? (h - ch) / 2 : 0) - box.y * zoom
  return { x, y, zoom }
}

/**
 * Works out how far to pan so that a box (the states involved in the
 * current animation step) is inside the visible pane, keeping the zoom.
 * Returns `null` when the box is already in view, so the camera does not
 * move needlessly. A box larger than the pane is centred.
 *
 * @param view - The current viewport.
 * @param width - Pane width in px.
 * @param height - Pane height in px.
 * @param box - Box to show, in graph coordinates.
 * @param margin - Space to keep from the pane edges, in px (default 24).
 * @returns The graph point to centre on, or `null` if no pan is needed.
 * @throws Never throws.
 */
export function panTarget(view: Viewport, width: number, height: number, box: Rect, margin = 24): XY | null {
  const left = (box.x * view.zoom + view.x)
  const right = (box.x + box.width) * view.zoom + view.x
  const top = box.y * view.zoom + view.y
  const bottom = (box.y + box.height) * view.zoom + view.y
  const minTop = TOP_INSET
  const inside = left >= margin && right <= width - margin && top >= minTop && bottom <= height - margin
  if (inside) return null
  // Centre of the visible area, in graph coordinates, then shift just enough on each axis.
  const visW = width / view.zoom
  const visH = (height - minTop) / view.zoom
  const cx = (width / 2 - view.x) / view.zoom
  const cy = ((height + minTop) / 2 - view.y) / view.zoom
  const m = margin / view.zoom
  const shift = (lo: number, hi: number, vis: number, c: number) => {
    const size = hi - lo
    if (size + 2 * m >= vis) return (lo + hi) / 2
    const visLo = c - vis / 2 + m
    const visHi = c + vis / 2 - m
    if (lo < visLo) return c - (visLo - lo)
    if (hi > visHi) return c + (hi - visHi)
    return c
  }
  return {
    x: shift(box.x, box.x + box.width, visW, cx),
    y: shift(box.y, box.y + box.height, visH, cy),
  }
}

/**
 * Bounding box of some state circles.
 *
 * @param positions - Top-left of each circle.
 * @returns The box, or `null` for an empty list.
 * @throws Never throws.
 */
export function circlesBox(positions: readonly XY[]): Rect | null {
  return drawingBounds({ positions })
}

/**
 * The viewport that keeps a box (the states of the current animation frame)
 * in view during playback. Pans only when the box fits at the current zoom;
 * otherwise zooms out just enough (never below {@link FIT_MIN_ZOOM}) and
 * centres it. Never zooms in.
 *
 * @param view - The current viewport.
 * @param width - Pane width in px.
 * @param height - Pane height in px.
 * @param box - Box to show, in graph coordinates.
 * @param margin - Space to keep from the pane edges, in px (default 24).
 * @returns The new viewport, or `null` when the box is already in view.
 * @throws Never throws.
 */
export function followViewport(view: Viewport, width: number, height: number, box: Rect, margin = 24): Viewport | null {
  const visW = width - 2 * margin
  const visH = height - TOP_INSET - margin
  const fits = box.width * view.zoom <= visW && box.height * view.zoom <= visH
  if (fits) {
    const c = panTarget(view, width, height, box, margin)
    if (!c) return null
    return { zoom: view.zoom, x: width / 2 - c.x * view.zoom, y: (height + TOP_INSET) / 2 - c.y * view.zoom }
  }
  const zoom = Math.max(FIT_MIN_ZOOM, Math.min(view.zoom, visW / Math.max(1, box.width), visH / Math.max(1, box.height)))
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const next = { zoom, x: width / 2 - cx * zoom, y: (height + TOP_INSET) / 2 - cy * zoom }
  const same = Math.abs(next.zoom - view.zoom) < 1e-3 && Math.abs(next.x - view.x) < 1 && Math.abs(next.y - view.y) < 1
  return same ? null : next
}
