import type { DFA } from '../../core'
import { dfaToENFA } from '../../core'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { captionRects, dfaCaption } from '../../model/dfaLayout'
import { mergedEdges } from '../../model/graph'
import { routeAll } from './flow'

const R = NODE_SIZE / 2

type DfaShape = { merged: ReturnType<typeof mergedEdges>; routes: ReturnType<typeof routeAll> }
const dfaShapes = new WeakMap<DFA, Map<string, DfaShape>>()

/**
 * Edges and routes of the part of a DFA found so far. Routing only changes
 * when a state or edge is added, so results are cached per shape and reused
 * across the frames of a step.
 *
 * @param dfa - The finished DFA (cache owner, captions).
 * @param layout - Top-left position of each state.
 * @param states - The states drawn.
 * @param transitions - The transitions drawn.
 * @returns The merged edges and their routes (kept clear of captions).
 */
export function dfaRoutes(dfa: DFA, layout: Record<string, XY>, states: string[], transitions: DFA['transitions']): DfaShape {
  const key = `${states.join(',')}|${JSON.stringify(transitions)}`
  let cache = dfaShapes.get(dfa)
  if (!cache) dfaShapes.set(dfa, (cache = new Map()))
  const hit = cache.get(key)
  if (hit) return hit
  const merged = mergedEdges(dfaToENFA({ ...dfa, states, transitions }))
  const centres = new Map<string, XY>(states.map((s) => [s, { x: (layout[s]?.x ?? 0) + R, y: (layout[s]?.y ?? 0) + R }]))
  const captions = Object.fromEntries(states.map((s) => [s, dfaCaption(dfa, s)]))
  const shape = { merged, routes: routeAll(merged, centres, captionRects(layout, captions, states)) }
  cache.set(key, shape)
  return shape
}

