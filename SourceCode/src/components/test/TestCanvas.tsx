import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ReactFlowProvider, type Edge, type Node } from 'reactflow'
import type { DFA } from '../../core'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { dfaCaption, layoutDFA } from '../../model/dfaLayout'
import { FRAME_MS } from '../../model/convertPlan'
import { largeDfaNotice } from '../../model/largeDfa'
import { mergedEdges } from '../../model/graph'
import { MAX_ANIMATED_SYMBOLS, dfaTraceCells, traceText } from '../../model/testRun'
import type { RunFrame } from '../../model/testPlan'
import { useApp } from '../../store/automaton'
import { useTest } from '../../store/test'
import { EDGE_COLOR } from '../canvas/colors'
import { arrow, prefersReducedMotion, routeAll } from '../canvas/flow'
import type { StateNodeData, TransitionEdgeData } from '../canvas/graphParts'
import { dfaRoutes } from '../canvas/dfaRoutes'
import { NotConvertible, Pane, Swatch } from '../convert/ConvertCanvas'
import { useConversion } from '../convert/useConversion'
import { useTestClock, useTestRun, useTestView, type TestView } from './testData'

const R = NODE_SIZE / 2
const hasPair = (list: readonly [string, string][], a: string, b: string) => list.some(([x, y]) => x === a && y === b)

/** Cell width for the tape: wide enough for the longest symbol. */
const cellWidth = (alphabet: readonly string[]) => Math.max(34, 14 + 8.5 * Math.max(1, ...alphabet.map((s) => [...s].length)))

/**
 * The input tape above both graphs. Consumed cells are muted, the symbol
 * being read is ringed by the head, which slides from cell to cell.
 */
function Tape({ view, tokens, error }: { view: TestView | null; tokens: string[]; error: string | null }) {
  const alphabet = useApp((s) => s.nfa.alphabet)
  const scroller = useRef<HTMLDivElement>(null)
  const w = cellWidth(alphabet)
  const step = view?.step ?? tokens.length
  // During step i the head is on symbol i (cell i-1); at the start it waits before the first cell.
  const head = step - 1
  const consumed = view?.frame && view.frame.phase === 'move' ? step - 1 : step

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const x = Math.max(0, head) * (w + 4)
    const left = el.scrollLeft
    if (x < left + 24 || x + w > left + el.clientWidth - 24) {
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
  }, [head, w])

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Tape</span>
      <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto py-1.5 [scrollbar-width:thin]">
        {error ? (
          <span className="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-800">{error}</span>
        ) : tokens.length === 0 ? (
          <span className="inline-flex h-8 items-center rounded-md border border-dashed border-slate-300 px-3 font-mono text-sm text-slate-500">ε · empty input</span>
        ) : (
          <ol aria-label="Input tape" className="relative flex w-max gap-1">
            {tokens.map((t, i) => {
              const reading = i === head
              const done = i < consumed && !reading
              return (
                <li
                  key={i}
                  aria-current={reading ? 'step' : undefined}
                  className={`grid h-8 place-items-center rounded-md border font-mono text-sm font-semibold transition-colors duration-150 ${
                    reading ? 'border-blue-200 bg-blue-50 text-blue-800' : done ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900'
                  }`}
                  style={{ width: w }}
                >
                  {t}
                </li>
              )
            })}
            <span
              aria-hidden="true"
              className="tape-head pointer-events-none absolute top-0 left-0 h-8 rounded-md border-2 border-blue-600"
              style={{ width: w, transform: `translateX(${head * (w + 4)}px)`, opacity: head < 0 ? 0 : 1 }}
            />
          </ol>
        )}
      </div>
      {view && (
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
          {Math.min(consumed, tokens.length)} / {tokens.length} read
        </span>
      )}
    </div>
  )
}

function RunLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <Swatch className="border-blue-700 bg-blue-600" label="Active" />
      <Swatch className="border-slate-900 bg-white shadow-[0_0_0_2px_#fff,0_0_0_4px_#2563eb]" label="move" />
      <Swatch className="border-violet-600 bg-violet-100" label="ε-closure" />
      <Swatch className="border-slate-900 bg-white opacity-30" label="Dead branch" />
    </div>
  )
}

const verdictWord = (accepted: boolean) => (accepted ? 'accepted' : 'rejected')

/** Left pane: the ε-NFA with the active set, the symbol tokens and the spreading ε-closure. */
function NfaRunPane({ view }: { view: TestView | null }) {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const speed = useTest((s) => s.speed)
  const frame: RunFrame | null = view?.frame ?? null
  const live = view?.live ?? false
  const step = view?.step ?? 0
  const finalSet = view && !view.frame ? view.run.trace.nfa.final : null
  const symbol = step > 0 ? view?.run.trace.steps[step - 1]?.symbol : undefined
  const tokenMs = Math.round((FRAME_MS.move / speed) * 0.85)

  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const finals = new Set(nfa.finals)
    const current = new Set(frame ? frame.current : (finalSet ?? []))
    const moved = new Set(frame?.moved ?? [])
    const closure = new Set(frame?.closure ?? [])
    const faded = new Set(frame?.faded ?? [])
    const pulse = live && frame?.pulse ? step * 100 + 1 : 0
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
        roleDelay: live && frame?.tokens && moved.has(s) ? tokenMs : 0,
        pulse: current.has(s) ? pulse : 0,
        faded: faded.has(s),
        motionMs: Math.round(FRAME_MS.pulse / speed),
      },
    }))
  }, [nfa, positions, frame, finalSet, step, live, tokenMs, speed])

  const merged = useMemo(() => mergedEdges(nfa), [nfa])
  const routes = useMemo(() => {
    const centres = new Map<string, XY>(nfa.states.map((s) => [s, { x: (positions[s]?.x ?? 0) + R, y: (positions[s]?.y ?? 0) + R }]))
    return routeAll(merged, centres)
  }, [merged, nfa.states, positions])

  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const symbolEdges = frame?.symbolEdges ?? []
    const epsEdges = frame?.epsilonEdges ?? []
    return merged.flatMap((e) => {
      const route = routes.get(e.id)
      if (!route) return []
      const lit = e.epsilonOnly ? hasPair(epsEdges, e.source, e.target) : symbol !== undefined && e.symbols.includes(symbol) && hasPair(symbolEdges, e.source, e.target)
      const token = lit && !e.epsilonOnly && live && frame?.tokens ? { label: symbol!, key: step, ms: tokenMs } : null
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
  }, [merged, routes, frame, symbol, live, step, tokenMs])

  const trace = view?.run.trace
  const subtitle = trace && view.atEnd ? `${nfa.states.length} states · ${verdictWord(trace.nfaAccepted)}` : `${nfa.states.length} states · Σ = {${nfa.alphabet.join(', ')}}`
  return (
    <Pane
      title="ε-NFA"
      subtitle={subtitle}
      nodes={nodes}
      edges={edges}
      fitKey={nfa.states.join(',')}
      legend={view?.frame ? <RunLegend /> : undefined}
      stateCount={nfa.states.length}
      fitMode="whole"
      focus={live && frame ? [...new Set([...frame.current, ...frame.moved, ...frame.closure])] : undefined}
    />
  )
}

/** Right pane: the whole DFA with the current state and the edge just taken. */
function DfaRunPane({ view, dfa }: { view: TestView | null; dfa: DFA }) {
  const speed = useTest((s) => s.speed)
  const layout = useMemo(() => layoutDFA(dfa), [dfa])
  const frame = view?.frame ?? null
  const live = view?.live ?? false
  const step = view?.step ?? 0
  const tokenMs = Math.round((FRAME_MS.move / speed) * 0.85)
  const edgeTaken = frame?.dfaEdge ?? null
  const current = frame ? frame.dfaCurrent : null

  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const finals = new Set(dfa.finals)
    return dfa.states.map((s) => ({
      id: s,
      type: 'state',
      position: layout[s] ?? { x: 0, y: 0 },
      width: NODE_SIZE,
      height: NODE_SIZE,
      data: {
        label: s,
        start: dfa.start === s,
        final: finals.has(s),
        highlight: null,
        readOnly: true,
        dead: s === dfa.deadState,
        caption: dfaCaption(dfa, s),
        role: { current: current === s },
        motionMs: Math.round(FRAME_MS.dfa / speed),
      },
    }))
  }, [dfa, layout, current, speed])

  const { merged, routes } = useMemo(() => dfaRoutes(dfa, layout, dfa.states, dfa.transitions), [dfa, layout])
  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    return merged.flatMap((e) => {
      const route = routes.get(e.id)
      if (!route) return []
      const lit = !!edgeTaken && edgeTaken.from === e.source && edgeTaken.to === e.target && e.symbols.includes(edgeTaken.symbol)
      const token = lit && live && frame?.dfaToken ? { label: edgeTaken!.symbol, key: step, ms: tokenMs } : null
      const color = lit ? EDGE_COLOR.highlight : EDGE_COLOR.normal
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'transition',
          markerEnd: arrow(color),
          zIndex: lit ? 1 : 0,
          data: { route, symbols: e.symbols, epsilonOnly: false, highlight: null, lit, token },
        },
      ]
    })
  }, [merged, routes, edgeTaken, live, frame, step, tokenMs])

  const trace = view?.run.trace
  const subtitle = trace && view.atEnd ? `${dfa.states.length} states · ${verdictWord(trace.dfaAccepted)}` : `${dfa.states.length} states`
  return (
    <Pane
      title="DFA"
      subtitle={subtitle}
      nodes={nodes}
      edges={edges}
      fitKey={dfa.states.join(',')}
      stateCount={dfa.states.length}
      fitMode="whole"
      focus={live && frame ? [frame.dfaCurrent, edgeTaken?.from, edgeTaken?.to].filter((x): x is string => !!x) : undefined}
    />
  )
}

/** Right pane when the run is not drawn: the DFA path as text. */
function StillDfaPane({ view, dfa, reason }: { view: TestView | null; dfa: DFA; reason: 'large' | 'long' }) {
  const path = view ? traceText(dfaTraceCells(view.run.trace)) : null
  return (
    <div className="grid h-full w-[40%] max-w-[460px] min-w-[300px] shrink-0 place-items-center overflow-auto bg-slate-50 p-5">
      <div role="status" className="max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">{reason === 'large' ? 'DFA diagram hidden' : 'Run shown as text'}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-pretty text-slate-600">
          {reason === 'large'
            ? largeDfaNotice(dfa.states.length, dfa.deadState !== null)
            : `The input has more than ${MAX_ANIMATED_SYMBOLS} symbols, so it is not animated. The traces on the right list every step.`}
        </p>
        {view && (
          <>
            <p className="mt-3 text-xs font-semibold text-slate-500">DFA path</p>
            <p className="mt-1 max-h-40 overflow-auto font-mono text-xs leading-relaxed break-all text-slate-800">{path}</p>
          </>
        )}
      </div>
    </div>
  )
}

/** Test-mode canvas: the input tape over the ε-NFA (left) and the DFA (right), animated symbol by symbol. */
export function TestCanvas() {
  useTestClock()
  const conversion = useConversion()
  const run = useTestRun()
  const view = useTestView()
  useEffect(() => () => useTest.getState().pause(), [])
  if (!conversion || !run) return <NotConvertible />
  const dfa = conversion.result.dfa
  const tokens = run.trace?.tokens ?? []
  return (
    <div className="flex h-full flex-col">
      <Tape view={view} tokens={tokens} error={run.check.ok ? null : run.check.message} />
      <div className="flex min-h-0 flex-1 divide-x divide-slate-200">
        <ReactFlowProvider>
          <NfaRunPane view={view} />
        </ReactFlowProvider>
        {run.still ? (
          <StillDfaPane view={view} dfa={dfa} reason={run.still} />
        ) : (
          <ReactFlowProvider>
            <DfaRunPane view={view} dfa={dfa} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  )
}
