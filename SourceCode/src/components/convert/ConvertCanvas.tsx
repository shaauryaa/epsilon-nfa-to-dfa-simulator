import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ReactFlow, { Background, BackgroundVariant, Controls, Panel, ReactFlowProvider, useReactFlow, type Edge, type Node } from 'reactflow'
import { dfaToENFA, epsilonClosureTrace, formatSet, type DFA } from '../../core'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { dfaCaption, layoutDFA } from '../../model/dfaLayout'
import { FRAME_MS } from '../../model/convertPlan'
import { mergedEdges } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { useConvert } from '../../store/convert'
import { EDGE_COLOR } from '../canvas/colors'
import { arrow, FIT, fitReadable, MINIMAP_MIN_STATES, routeAll } from '../canvas/flow'
import { MIN_ZOOM, StateNode, TransitionEdge, type StateNodeData, type TransitionEdgeData } from '../canvas/graphParts'
import { CanvasMiniMap, MapToggle, toolButton } from '../canvas/GraphView'
import { Button } from '../ui/Button'
import { AlertIcon, FitIcon } from '../ui/Icons'
import { useConvertClock, useConvertView, type ConvertView } from './useConversion'

const nodeTypes = { state: StateNode }
const edgeTypes = { transition: TransitionEdge }
const R = NODE_SIZE / 2


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
}

/** One read-only React Flow canvas with a title, Fit and Map controls. */
function Pane({ title, subtitle, nodes, edges, fitKey, legend, stateCount }: PaneProps) {
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)
  const [mapChoice, setMapChoice] = useState<boolean | null>(null)
  const showMap = mapChoice ?? stateCount >= MINIMAP_MIN_STATES
  const fit = (duration = 0) => fitReadable(rf, wrapper.current, { includeHidden: true, duration })

  useEffect(() => {
    const id = requestAnimationFrame(() => fitReadable(rf, wrapper.current, { includeHidden: true }))
    return () => cancelAnimationFrame(id)
  }, [fitKey, rf])

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
      frame = requestAnimationFrame(() => fitReadable(rf, wrapper.current, { includeHidden: true }))
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
        onInit={(inst) => requestAnimationFrame(() => fitReadable(inst, wrapper.current, { includeHidden: true }))}
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
            <button type="button" className={toolButton} onClick={() => fit(250)} title="Fit the diagram to the pane">
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

/** Left pane: the ε-NFA with the current step's sets and edges highlighted. */
function NfaPane({ view }: { view: ConvertView }) {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const picked = useConvert((s) => s.pickedClosure)
  const speed = useConvert((s) => s.speed)
  const { frame, step, live } = view

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
  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const centres = new Map<string, XY>(nodes.map((n) => [n.id, { x: n.position.x + R, y: n.position.y + R }]))
    const routes = routeAll(merged, centres)
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
  }, [merged, nodes, frame, step, live, pickedTrace, tokenMs])

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
      fitKey={`${nfa.states.length}`}
      legend={<NfaLegend />}
      stateCount={nfa.states.length}
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

  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const partial: DFA = { ...dfa, states: progress.states, transitions: progress.transitions }
    const merged = mergedEdges(dfaToENFA(partial))
    const centres = new Map<string, XY>(progress.states.map((s) => [s, { x: (layout[s]?.x ?? 0) + R, y: (layout[s]?.y ?? 0) + R }]))
    const routes = routeAll(merged, centres, true)
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
  }, [dfa, progress, layout, step.index, live, motionMs])

  return (
    <Pane
      title="DFA"
      subtitle={`${progress.states.length} of ${dfa.states.length} states found`}
      nodes={nodes}
      edges={edges}
      fitKey={dfa.states.join(',')}
      stateCount={dfa.states.length}
    />
  )
}

/** Shown instead of the panes while the machine has errors. */
function NotConvertible() {
  const errors = useApp((s) => s.validation.errors.length)
  const setTab = useApp((s) => s.setActiveTab)
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
  const view = useConvertView()
  useEffect(() => () => useConvert.getState().pause(), [])
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
