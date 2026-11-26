import { getRectOfNodes, MarkerType, type ReactFlowInstance } from 'reactflow'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { routeAll as routeAllR, type RoutableEdge, type Route } from '../../graph/routing'
import { MIN_ZOOM } from './graphParts'

/** Fit-view settings shared by every canvas: tight padding, never below the readable zoom. */
export const FIT = { padding: 0.08, maxZoom: 1.25, minZoom: MIN_ZOOM }
/** Below this many states the mini map starts hidden. */
export const MINIMAP_MIN_STATES = 15
/** Arrowhead marker in the given colour. */
export const arrow = (color: string) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color })

/** Routes edges between state circles of the canvas size; see `routeAll` in the routing module. */
export function routeAll(edges: readonly RoutableEdge[], centres: ReadonlyMap<string, XY>, captions = false): Map<string, Route> {
  const avoid = captions ? [...centres.values()].map((c) => ({ x: c.x, y: c.y + NODE_SIZE / 2 + 14 })) : []
  return routeAllR(edges, centres, NODE_SIZE / 2, avoid)
}

/** Space kept clear at the top of a canvas for its title and toolbar, in px. */
const TOP_INSET = 56

/**
 * Fits the diagram to its canvas at a readable zoom. When the whole diagram
 * fits, it is centred; when it would have to shrink below {@link MIN_ZOOM},
 * the zoom stays readable and the view starts at the left (where the start
 * state is), so the user pans right instead of squinting.
 *
 * @param rf - The React Flow instance.
 * @param el - The canvas element (for its size).
 * @param opts - Include hidden nodes (DFA states not yet discovered); animation length.
 */
export function fitReadable(
  rf: ReactFlowInstance,
  el: HTMLElement | null,
  opts: { includeHidden?: boolean; duration?: number } = {},
): void {
  const nodes = rf.getNodes().filter((n) => opts.includeHidden || !n.hidden)
  if (!el || nodes.length === 0) return
  const b = getRectOfNodes(nodes)
  // Room for the start arrow, self-loops above, captions below.
  const box = { x: b.x - 52, y: b.y - 64, width: b.width + 52 + 8, height: b.height + 64 + 30 }
  const w = el.clientWidth
  const h = el.clientHeight - TOP_INSET
  const pad = 1 + 2 * FIT.padding
  const zoom = Math.max(MIN_ZOOM, Math.min(FIT.maxZoom, w / (box.width * pad), h / (box.height * pad)))
  const cw = box.width * zoom
  const ch = box.height * zoom
  const x = cw <= w ? (w - cw) / 2 - box.x * zoom : 16 - box.x * zoom
  const y = TOP_INSET + (ch <= h ? (h - ch) / 2 : 8) - box.y * zoom
  rf.setViewport({ x, y, zoom }, { duration: opts.duration ?? 0 })
}
