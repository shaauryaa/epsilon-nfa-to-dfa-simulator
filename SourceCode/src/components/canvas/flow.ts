import { MarkerType, type Edge, type Node, type ReactFlowInstance } from 'reactflow'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { labelHalfWidth, routeAll as routeAllR, type Rect, type RoutableEdge, type Route } from '../../graph/routing'
import { captionRect } from '../../model/dfaLayout'
import { drawingBounds, FIT_MAX_ZOOM, FIT_MIN_ZOOM, fitViewport, type FitMode } from '../../model/viewport'
import type { StateNodeData, TransitionEdgeData } from './graphParts'

/** Fit-view settings for React Flow's own controls; the canvases override the action with {@link fitReadable}. */
export const FIT = { padding: 0.08, maxZoom: FIT_MAX_ZOOM, minZoom: FIT_MIN_ZOOM }
/** Below this many states the mini map starts hidden. */
export const MINIMAP_MIN_STATES = 15
/** Arrowhead marker in the given colour. */
export const arrow = (color: string) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color })

/**
 * Routes edges between state circles of the canvas size; see `routeAll` in
 * the routing module.
 *
 * @param edges - Edges to route.
 * @param centres - Circle centre per state.
 * @param blocks - Caption boxes that edges and labels must not cross.
 * @returns Route per edge id.
 */
export function routeAll(edges: readonly RoutableEdge[], centres: ReadonlyMap<string, XY>, blocks: readonly Rect[] = []): Map<string, Route> {
  return routeAllR(edges, centres, NODE_SIZE / 2, blocks)
}

/** Options for {@link fitReadable}. */
export interface FitOptions {
  /** Include hidden nodes (DFA states not yet discovered). */
  includeHidden?: boolean
  /** Animation length in ms (0 = jump). Reduced motion always jumps. */
  duration?: number
  /** The nodes to fit (defaults to the instance's, which can lag one render behind a just-changed machine). */
  nodes?: readonly Node[]
  /** The edges whose paths and labels must fit too (default: none). */
  edges?: readonly Edge[]
  /**
   * `readable` (default, the automatic view) never zooms below the readable
   * floor and starts big graphs at the left; `whole` (the Fit button) always
   * shows the whole graph.
   */
  mode?: FitMode
  /** Space kept clear at the bottom (e.g. for a legend), in px. */
  bottomInset?: number
}

/** True when the user asked for reduced motion. */
export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Measures nodes (with captions and the start arrow) and edges (paths and
 * label pills) in graph coordinates.
 *
 * @param nodes - React Flow nodes with `StateNodeData`.
 * @param edges - React Flow edges with `TransitionEdgeData`.
 * @returns The bounding box, or `null` if there is nothing to draw.
 */
export function graphBounds(nodes: readonly Node[], edges: readonly Edge[] = []): Rect | null {
  const startNode = nodes.find((n) => (n.data as StateNodeData | undefined)?.start)
  const captions = nodes.flatMap((n) => {
    const text = (n.data as StateNodeData | undefined)?.caption
    return text ? [captionRect({ x: n.position.x + NODE_SIZE / 2, y: n.position.y + NODE_SIZE / 2 }, text)] : []
  })
  const routed = edges.flatMap((e) => {
    const d = e.data as TransitionEdgeData | undefined
    return d?.route ? [d] : []
  })
  return drawingBounds({
    positions: nodes.map((n) => n.position),
    start: startNode?.position ?? null,
    captions,
    paths: routed.map((d) => d.route.path),
    labels: routed.map((d) => ({ x: d.route.labelX, y: d.route.labelY, halfWidth: labelHalfWidth(d.symbols.join(', ')) })),
  })
}

/**
 * Fits the diagram to its canvas. In `readable` mode (the automatic view) a
 * diagram that would shrink below the readable zoom stays readable and
 * starts at the left; in `whole` mode (the Fit button) the whole diagram is
 * shown, zooming out as far as needed (down to `FIT_MIN_ZOOM`). Small
 * diagrams scale up to use the pane.
 *
 * @param rf - The React Flow instance.
 * @param el - The canvas element (for its size).
 * @param opts - See {@link FitOptions}.
 */
export function fitReadable(rf: ReactFlowInstance, el: HTMLElement | null, opts: FitOptions = {}): void {
  const nodes = (opts.nodes ?? rf.getNodes()).filter((n) => opts.includeHidden || !n.hidden)
  if (!el || nodes.length === 0) return
  const ids = new Set(nodes.map((n) => n.id))
  const edges = (opts.edges ?? []).filter((e) => ids.has(e.source) && ids.has(e.target))
  const box = graphBounds(nodes, edges)
  if (!box) return
  const view = fitViewport(box, el.clientWidth, el.clientHeight, opts.mode ?? 'readable', opts.bottomInset ?? 0)
  rf.setViewport(view, { duration: prefersReducedMotion() ? 0 : (opts.duration ?? 0) })
}
