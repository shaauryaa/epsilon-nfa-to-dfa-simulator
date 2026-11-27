/**
 * Left-to-right auto layout for automaton graphs, using dagre.
 */

import dagre from 'dagre'

/** A point in graph coordinates. */
export interface XY {
  x: number
  y: number
}

/** Diameter of a state circle, in pixels. Shared by layout, nodes and routing. */
export const NODE_SIZE = 56

/** Spacing for {@link layoutLR}, in pixels. */
export interface LayoutSpacing {
  /** Gap between states in the same column. */
  nodesep?: number
  /** Gap between columns. */
  ranksep?: number
}

/**
 * Lays out states left to right with dagre. The default spacing is tight so
 * an 11-state machine still reads at projector resolution.
 *
 * @param states - Node ids in declaration order.
 * @param edges - Directed edges between declared states (self-loops allowed;
 *   dagre ignores them for ranking).
 * @param spacing - Optional gaps; defaults are 30px within a column and 40px
 *   between columns.
 * @param boxes - Optional layout box per node, when a node needs more room
 *   than its circle (e.g. a caption underneath). The circle sits at the top
 *   centre of its box, so dagre keeps the whole box clear of other nodes.
 * @returns Top-left position of each node's circle, keyed by id.
 * @throws Never throws for edges between listed states.
 */
export function layoutLR(
  states: readonly string[],
  edges: readonly { source: string; target: string }[],
  spacing: LayoutSpacing = {},
  boxes: Readonly<Record<string, { width: number; height: number }>> = {},
): Record<string, XY> {
  const g = new dagre.graphlib.Graph({ multigraph: false })
  g.setGraph({ rankdir: 'LR', nodesep: spacing.nodesep ?? 30, ranksep: spacing.ranksep ?? 40, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  const box = (s: string) => ({ width: Math.max(NODE_SIZE, boxes[s]?.width ?? 0), height: Math.max(NODE_SIZE, boxes[s]?.height ?? 0) })
  for (const s of states) g.setNode(s, box(s))
  for (const e of edges) if (e.source !== e.target) g.setEdge(e.source, e.target)
  dagre.layout(g)
  const out: Record<string, XY> = {}
  for (const s of states) {
    const n = g.node(s)
    out[s] = { x: Math.round(n.x - NODE_SIZE / 2), y: Math.round(n.y - box(s).height / 2) }
  }
  return out
}
