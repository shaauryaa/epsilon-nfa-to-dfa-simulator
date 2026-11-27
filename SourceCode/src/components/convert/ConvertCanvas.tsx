import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ReactFlow, { Background, BackgroundVariant, Controls, Panel, ReactFlowProvider, useReactFlow, type Edge, type Node } from 'reactflow'
import { dfaToENFA, epsilonClosureTrace, formatSet, type DFA, type SubsetStep } from '../../core'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { captionRects, dfaCaption, layoutDFA } from '../../model/dfaLayout'
import { FRAME_MS, type Frame } from '../../model/convertPlan'
import { largeDfaNotice } from '../../model/largeDfa'
import { mergedEdges } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { useConvert } from '../../store/convert'
import { EDGE_COLOR } from '../canvas/colors'
import { arrow, FIT, fitReadable, MINIMAP_MIN_STATES, prefersReducedMotion, routeAll } from '../canvas/flow'
import { circlesBox, followViewport } from '../../model/viewport'
import { MIN_ZOOM, StateNode, TransitionEdge, type StateNodeData, type TransitionEdgeData } from '../canvas/graphParts'
import { CanvasMiniMap, MapToggle, toolButton } from '../canvas/GraphView'
import { Button } from '../ui/Button'
import { AlertIcon, FitIcon } from '../ui/Icons'
import { useConversion, useConvertClock, useConvertView, type ConvertView } from './useConversion'
import type { Conversion } from '../../store/convert'

const nodeTypes = { state: StateNode }
const edgeTypes = { transition: TransitionEdge }
const R = NODE_SIZE / 2


type DfaShape = { merged: ReturnType<typeof mergedEdges>; routes: ReturnType<typeof routeAll> }
const dfaShapes = new WeakMap<DFA, Map<string, DfaShape>>()

/**
 * Edges and routes of the part of a DFA found so far. Routing only changes
 * when a state or edge is added, so results are cached per shape and reused
 * across the frames of a step.
 */
function dfaRoutes(dfa: DFA, layout: Record<string, XY>, states: string[], transitions: DFA['transitions']): DfaShape {
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

const hasPair = (list: readonly [string, string][], a: string, b: string) => list.some(([x, y]) => x === a && y === b)

interface PaneProps {
  title: string
  subtitle: ReactNode
  nodes: Node<StateNodeData>[]
  edges: Edge<TransitionEdgeData>[]
  /** Changes when the pane should re-fit. */
  fitKey: string
  legend?: ReactNode
  stateCount: number
  /** States the current animation frame involves; the camera pans to keep them in view. */
  focus?: string[]
}

/** Time for the camera to follow playback, in ms. */
const FOLLOW_MS = 360

/** One read-only React Flow canvas with a title, Fit and Map controls. */
function Pane({ title, subtitle, nodes, edges, fitKey, legend, stateCount, focus }: PaneProps) {
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)
  const [mapChoice, setMapChoice] = useState<boolean | null>(null)
  const showMap = mapChoice ?? stateCount >= MINIMAP_MIN_STATES
  const latest = useRef(nodes)
  const latestEdges = useRef(edges)
  useLayoutEffect(() => {
    latest.current = nodes
    latestEdges.current = edges
  }, [nodes, edges])
  /** Fit button: the whole graph, zooming out as far as needed. */
  const fit = (duration = 0) =>
    fitReadable(rf, wrapper.current, { includeHidden: true, duration, nodes: latest.current, edges: latestEdges.current, mode: 'whole' })

  useEffect(() => {
    const id = requestAnimationFrame(() => fitReadable(rf, wrapper.current, { includeHidden: true, nodes: latest.current, edges: latestEdges.current }))
    return () => cancelAnimationFrame(id)
  }, [fitKey, rf])

  // Follow playback: pan (and zoom out only if needed) to bring the frame's states into view.
  const focusKey = focus && focus.length > 0 ? focus.join(',') : ''
  useEffect(() => {
    const el = wrapper.current
    if (!el || !focusKey) return
    const ids = new Set(focusKey.split(','))
    const box = circlesBox(latest.current.filter((n) => ids.has(n.id)).map((n) => n.position))
    if (!box) return
    // Room for captions below and self-loop labels above.
    const padded = { x: box.x - 20, y: box.y - 40, width: box.width + 40, height: box.height + 76 }
    const next = followViewport(rf.getViewport(), el.clientWidth, el.clientHeight, padded)
    if (next) rf.setViewport(next, { duration: prefersReducedMotion() ? 0 : FOLLOW_MS })
  }, [focusKey, rf])

  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    let frame = 0
    let last = ''
    const ro = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`
      if (size === last) return
      const first = last === ''
      last = size
      if (first) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fitReadable(rf, wrapper.current, { includeHidden: true, nodes: latest.current, edges: latestEdges.current }))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [rf])

  return (
    <div ref={wrapper} className="relative h-full min-w-0 flex-1 bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        onInit={(inst) => requestAnimationFrame(() => fitReadable(inst, wrapper.current, { includeHidden: true, nodes: latest.current, edges: latestEdges.current }))}
        minZoom={MIN_ZOOM}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#cbd5e1" />
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={{ ...FIT, includeHiddenNodes: true }} onFitView={() => fit()} />
        {showMap && <CanvasMiniMap />}
        <Panel position="top-left" className="!m-3">
          <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm">
            <h3 className="text-xs font-semibold tracking-wide text-slate-700">{title}</h3>
            <p className="text-xs text-slate-500 tabular-nums">{subtitle}</p>
          </div>
        </Panel>
        <Panel position="top-right" className="!m-3">
          <div role="toolbar" aria-label={`${title} canvas`} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" className={toolButton} onClick={() => fit(250)} title="Show the whole diagram">
              <FitIcon size={13} /> Fit
            </button>
            <MapToggle on={showMap} onToggle={() => setMapChoice(!showMap)} />
          </div>
        </Panel>
        {legend && (
          <Panel position="bottom-left" className="!mb-[15px] !ml-[52px]">
            {legend}
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block size-3.5 rounded-full border-[1.6px] ${className}`} />
      {label}
    </span>
  )
}

function NfaLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <Swatch className="border-blue-700 bg-blue-600" label="Set S" />
      <Swatch className="border-slate-900 bg-white shadow-[0_0_0_2px_#fff,0_0_0_4px_#2563eb]" label="move(S, a)" />
      <Swatch className="border-violet-600 bg-violet-100" label="ε-closure" />
    </div>
  )
}

/** The ε-NFA with nothing highlighted (large DFAs are not animated). */
const IDLE_FRAME: Pick<Frame, 'current' | 'moved' | 'closure' | 'symbolEdges' | 'epsilonEdges' | 'pulse' | 'tokens'> = {
  current: [],
  moved: [],
  closure: [],
  symbolEdges: [],
  epsilonEdges: [],
  pulse: false,
  tokens: false,
}
const IDLE_STEP: Pick<SubsetStep, 'index' | 'symbol'> = { index: 0, symbol: undefined }

/** Left pane: the ε-NFA with the current step's sets and edges highlighted (`view` null: no step highlight). */
function NfaPane({ view }: { view: ConvertView | null }) {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const picked = useConvert((s) => s.pickedClosure)
  const speed = useConvert((s) => s.speed)
  const frame = view?.frame ?? IDLE_FRAME
  const step = view?.step ?? IDLE_STEP
  const live = view?.live ?? false

  // A row picked in the closure table overrides the player's highlight.
  const pickedTrace = useMemo(() => {
    if (!picked || !nfa.states.includes(picked)) return null
    return epsilonClosureTrace(nfa, [picked])
  }, [picked, nfa])

  const tokenMs = Math.round((FRAME_MS.move / speed) * 0.85)
  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const finals = new Set(nfa.finals)
    const current = new Set(pickedTrace ? [picked!] : frame.current)
    const moved = new Set(pickedTrace ? [] : frame.moved)
    const closure = new Set(pickedTrace ? pickedTrace.closure : frame.closure)
    const pulse = live && frame.pulse && !pickedTrace ? step.index * 100 + 1 : 0
    return [...new Set(nfa.states)].map((s) => ({
      id: s,
      type: 'state',
      position: positions[s] ?? { x: 0, y: 0 },
      width: NODE_SIZE,
      height: NODE_SIZE,
      data: {
        label: s,
        start: nfa.start === s,
        final: finals.has(s),
        highlight: null,
        readOnly: true,
        role: { current: current.has(s), moved: moved.has(s), closure: closure.has(s) },
        roleDelay: live && frame.tokens && moved.has(s) ? tokenMs : 0,
        pulse: current.has(s) ? pulse : 0,
        motionMs: Math.round(FRAME_MS.pulse / speed),
      },
    }))
  }, [nfa, positions, frame, step.index, live, pickedTrace, picked, tokenMs, speed])

  const merged = useMemo(() => mergedEdges(nfa), [nfa])
  // Routes depend only on positions, not on the frame, so they are computed once per layout.
  const routes = useMemo(() => {
    const centres = new Map<string, XY>(nfa.states.map((s) => [s, { x: (positions[s]?.x ?? 0) + R, y: (positions[s]?.y ?? 0) + R }]))
    return routeAll(merged, centres)
  }, [merged, nfa.states, positions])
  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const symbolEdges = pickedTrace ? [] : frame.symbolEdges
    const epsEdges = pickedTrace ? pickedTrace.edges : frame.epsilonEdges
    return merged.flatMap((e) => {
      const route = routes.get(e.id)
      if (!route) return []
      const lit = e.epsilonOnly
        ? hasPair(epsEdges, e.source, e.target)
        : step.symbol !== undefined && e.symbols.includes(step.symbol) && hasPair(symbolEdges, e.source, e.target)
      const token = lit && !e.epsilonOnly && live && frame.tokens ? { label: step.symbol!, key: step.index, ms: tokenMs } : null
      const color = lit ? (e.epsilonOnly ? EDGE_COLOR.epsilon : EDGE_COLOR.highlight) : e.epsilonOnly ? EDGE_COLOR.epsilon : EDGE_COLOR.normal
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'transition',
          markerEnd: arrow(color),
          zIndex: lit ? 1 : 0,
          data: { route, symbols: e.symbols, epsilonOnly: e.epsilonOnly, highlight: null, lit, token },
        },
      ]
    })
  }, [merged, routes, frame, step, live, pickedTrace, tokenMs])

  const subtitle = pickedTrace ? (
    <>
      ε-closure({picked}) = {formatSet(pickedTrace.closure)}
    </>
  ) : (
    `${nfa.states.length} states · Σ = {${nfa.alphabet.join(', ')}}`
  )
  return (
    <Pane
      title="ε-NFA"
      subtitle={subtitle}
      nodes={nodes}
      edges={edges}
      fitKey={nfa.states.join(',')}
      legend={view ? <NfaLegend /> : undefined}
      stateCount={nfa.states.length}
      focus={live && !pickedTrace ? [...new Set([...frame.current, ...frame.moved, ...frame.closure])] : undefined}
    />
  )
}

/** Right pane: the DFA as it is built; only discovered states are shown. */
function DfaPane({ view }: { view: ConvertView }) {
  const speed = useConvert((s) => s.speed)
  const { conversion, progress, step, live } = view
  const dfa = conversion.result.dfa
  const layout = useMemo(() => layoutDFA(dfa), [dfa])
  const motionMs = Math.round(FRAME_MS.dfa / speed)

  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const visible = new Set(progress.states)
    const finals = new Set(dfa.finals)
    return dfa.states.map((s) => ({
      id: s,
      type: 'state',
      position: layout[s] ?? { x: 0, y: 0 },
      width: NODE_SIZE,
      height: NODE_SIZE,
      hidden: !visible.has(s),
      data: {
        label: s,
        start: dfa.start === s,
        final: finals.has(s),
        highlight: null,
        readOnly: true,
        dead: s === dfa.deadState,
        caption: dfaCaption(dfa, s),
        role: { current: step.kind === 'transition' && step.from === s },
        entering: live && progress.entering === s,
        flash: live && progress.flashing === s ? step.index + 1 : 0,
        motionMs,
      },
    }))
  }, [dfa, layout, progress, step, live, motionMs])

  const { merged, routes } = useMemo(() => dfaRoutes(dfa, layout, progress.states, progress.transitions), [dfa, layout, progress.states, progress.transitions])
  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const d = progress.drawing
    return merged.flatMap((e) => {
      const route = routes.get(e.id)
      if (!route) return []
      const isNew = !!d && d.from === e.source && d.to === e.target && e.symbols.includes(d.symbol)
      const color = isNew ? EDGE_COLOR.highlight : EDGE_COLOR.normal
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'transition',
          markerEnd: arrow(color),
          zIndex: isNew ? 1 : 0,
          data: {
            route,
            symbols: e.symbols,
            epsilonOnly: false,
            highlight: null,
            lit: isNew,
            draw: isNew && live ? { key: step.index, ms: motionMs } : null,
          },
        },
      ]
    })
  }, [merged, routes, progress.drawing, step.index, live, motionMs])

  return (
    <Pane
      title="DFA"
      subtitle={`${progress.states.length} of ${dfa.states.length} states found`}
      nodes={nodes}
      edges={edges}
      fitKey={dfa.states.join(',')}
      stateCount={dfa.states.length}
      focus={live ? [step.kind === 'transition' ? step.from : undefined, progress.entering ?? progress.flashing ?? undefined].filter((x): x is string => !!x) : undefined}
    />
  )
}

/** Right pane for a DFA too large to draw: a calm notice instead of the diagram. */
function LargeDfaPane({ conversion }: { conversion: Conversion }) {
  const dfa = conversion.result.dfa
  return (
    <div className="grid h-full min-w-0 flex-1 place-items-center bg-slate-50 p-6">
      <div role="status" className="max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">DFA diagram hidden</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-pretty text-slate-600">{largeDfaNotice(dfa.states.length, dfa.deadState !== null)}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          The full DFA table is on the right, page by page. CSV, JSON and the other text downloads still contain every state.
        </p>
      </div>
    </div>
  )
}

/** Shown instead of the panes when subset construction stopped at the state cap. */
function TooLargeToBuild({ message }: { message: string }) {
  const setTab = useApp((s) => s.setActiveTab)
  return (
    <div className="grid h-full place-items-center bg-slate-50 p-6">
      <div role="status" className="max-w-md rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">This DFA is too large to build here</p>
        <p className="mt-1.5 text-sm leading-relaxed text-pretty text-slate-600">{message}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setTab('define')}>
          Back to Define
        </Button>
      </div>
    </div>
  )
}

/** Shown instead of the panes while the machine has errors. */
function NotConvertible() {
  const errors = useApp((s) => s.validation.errors.length)
  const failure = useApp((s) => s.error)
  const setTab = useApp((s) => s.setActiveTab)
  if (failure && errors === 0) return <TooLargeToBuild message={failure} />
  return (
    <div className="grid h-full place-items-center bg-slate-50 p-6">
      <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <AlertIcon size={20} className="mx-auto text-red-600" />
        <p className="mt-2 text-sm font-semibold text-slate-900">This machine can’t be converted yet</p>
        <p className="mt-1 text-sm text-slate-600">
          Fix the {errors === 1 ? 'error' : `${errors} errors`} listed on the right, then come back.
        </p>
        <Button variant="primary" size="sm" className="mt-4" onClick={() => setTab('define')}>
          Go to Define
        </Button>
      </div>
    </div>
  )
}

/** Convert-mode canvas: ε-NFA on the left, the DFA being built on the right. */
export function ConvertCanvas() {
  useConvertClock()
  const conversion = useConversion()
  const view = useConvertView()
  useEffect(() => () => useConvert.getState().pause(), [])
  if (conversion?.large) {
    return (
      <div className="flex h-full divide-x divide-slate-200">
        <ReactFlowProvider>
          <NfaPane view={null} />
        </ReactFlowProvider>
        <LargeDfaPane conversion={conversion} />
      </div>
    )
  }
  if (!view) return <NotConvertible />
  return (
    <div className="flex h-full divide-x divide-slate-200">
      <ReactFlowProvider>
        <NfaPane view={view} />
      </ReactFlowProvider>
      <ReactFlowProvider>
        <DfaPane view={view} />
      </ReactFlowProvider>
    </div>
  )
}
