import type { DFA } from '../../core'
import { dfaToENFA } from '../../core'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { captionRects, dfaCaption } from '../../model/dfaLayout'
import { mergedEdges } from '../../model/graph'
import { routeAll } from './flow'

const R = NODE_SIZE / 2

type DfaShape = { merged: ReturnType<typeof mergedEdges>; routes: ReturnType<typeof routeAll> }
const dfaShapes = new WeakMap<DFA, Map<string, DfaShape>>()

function route(dfa: DFA, layout: Record<string, XY>, states: string[], transitions: DFA['transitions'], captionOf?: Readonly<Record<string, string>>): DfaShape {
  const merged = mergedEdges(dfaToENFA({ ...dfa, states, transitions }))
  const centres = new Map<string, XY>(states.map((s) => [s, { x: (layout[s]?.x ?? 0) + R, y: (layout[s]?.y ?? 0) + R }]))
  const captions = captionOf ?? Object.fromEntries(states.map((s) => [s, dfaCaption(dfa, s)]))
  return { merged, routes: routeAll(merged, centres, captionRects(layout, captions, states)) }
}

/**
 * Edges and routes of the part of a DFA drawn so far. Every edge keeps the
 * route it has in the finished drawing, so edges never jump as states and
 * edges appear, and a view fitted to the finished DFA holds every edge.
 * Results are cached per shape and reused across the frames of a step.
 *
 * @param dfa - The finished DFA (cache owner, captions).
 * @param layout - Top-left position of each state.
 * @param states - The states drawn.
 * @param transitions - The transitions drawn (a subset of the DFA's).
 * @param captionOf - Caption per state (default: the NFA subset); routes keep clear of them.
 * @returns The merged edges of the drawn part and their routes (kept clear of captions).
 * @throws Never throws.
 */
export function dfaRoutes(dfa: DFA, layout: Record<string, XY>, states: string[], transitions: DFA['transitions'], captionOf?: Readonly<Record<string, string>>): DfaShape {
  const tag = captionOf ? 'c' : 's'
  const key = `${tag}|${states.join(',')}|${JSON.stringify(transitions)}`
  let cache = dfaShapes.get(dfa)
  if (!cache) dfaShapes.set(dfa, (cache = new Map()))
  const hit = cache.get(key)
  if (hit) return hit
  const fullKey = `${tag}|full`
  let full = cache.get(fullKey)
  if (!full) cache.set(fullKey, (full = route(dfa, layout, dfa.states, dfa.transitions, captionOf)))
  const merged = mergedEdges(dfaToENFA({ ...dfa, states, transitions }))
  const shape = merged.every((e) => full.routes.has(e.id))
    ? { merged, routes: full.routes }
    : route(dfa, layout, states, transitions, captionOf)
  cache.set(key, shape)
  return shape
}
