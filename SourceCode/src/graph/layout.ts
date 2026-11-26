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
export const NODE_SIZE = 52

/**
 * Lays out states left to right with dagre.
 *
 * @param states - Node ids in declaration order.
 * @param edges - Directed edges between declared states (self-loops allowed;
 *   dagre ignores them for ranking).
 * @returns Top-left position of each node, keyed by id.
 * @throws Never throws for edges between listed states.
 */
export function layoutLR(states: readonly string[], edges: readonly { source: string; target: string }[]): Record<string, XY> {
  const g = new dagre.graphlib.Graph({ multigraph: false })
  g.setGraph({ rankdir: 'LR', nodesep: 44, ranksep: 58, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const s of states) g.setNode(s, { width: NODE_SIZE, height: NODE_SIZE })
  for (const e of edges) if (e.source !== e.target) g.setEdge(e.source, e.target)
  dagre.layout(g)
  const out: Record<string, XY> = {}
  for (const s of states) {
    const n = g.node(s)
    out[s] = { x: Math.round(n.x - NODE_SIZE / 2), y: Math.round(n.y - NODE_SIZE / 2) }
  }
  return out
}
