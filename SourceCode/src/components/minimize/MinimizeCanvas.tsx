import { useMemo } from 'react'
import { ReactFlowProvider, type Edge, type Node } from 'reactflow'
import type { DFA } from '../../core'
import { NODE_SIZE } from '../../graph/layout'
import { dfaCaption, dfaCaptions, layoutDFA, roughBox } from '../../model/dfaLayout'
import { blockColor, minStateLabel, partitionText, type MinimizeView } from '../../model/minimizeView'
import { useMinimize } from '../../store/minimize'
import { EDGE_COLOR } from '../canvas/colors'
import { dfaRoutes } from '../canvas/dfaRoutes'
import { arrow } from '../canvas/flow'
import type { StateNodeData, TransitionEdgeData } from '../canvas/graphParts'
import { CanvasBar, SplitPanes } from '../canvas/SplitPanes'
import { NotConvertible, Pane, Swatch } from '../convert/ConvertCanvas'
import { useMinimizeClock, useMinimizeView, type MinimizeViewState } from './useMinimize'

/** Time a lit witness edge's token takes, as a share of the witness frame. */
const TOKEN_SHARE = 0.55
/** Longest recolour delay in a split, in ms. Gaps shrink (0, 50, 87, 116, …) so the wave eases out and never reaches 200 ms. */
const RECOLOUR_MAX_MS = 200
const recolourDelay = (i: number) => Math.round(RECOLOUR_MAX_MS * (1 - 0.75 ** i))

function WitnessLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <Swatch className="border-slate-500 bg-white shadow-[0_0_0_4px_rgb(37_99_235/0.25)]" label="Block being split" />
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded bg-blue-600" />
        Moves on the splitting symbol
      </span>
    </div>
  )
}

/** Captions of the minimal DFA: the full merged name when it does not fit in the circle. */
function minCaptions(dfa: DFA): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of dfa.states) {
    const c = minStateLabel(s).caption
    if (c) out[s] = c
  }
  return out
}

/** The DFA being minimised, with each state coloured by its block. */
function WorkPane({ state }: { state: MinimizeViewState }) {
  const speed = useMinimize((s) => s.speed)
  const { min, step, frame, canvas, live, index } = state
  const work = min.view.work
  const layout = useMemo(() => layoutDFA(work), [work])
  const tokenMs = Math.round((frame.ms / speed) * TOKEN_SHARE)

  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const visible = new Set(canvas.visible)
    const finals = new Set(work.finals)
    const faded = new Set(canvas.faded)
    const ringed = new Set(canvas.ringed)
    const order = new Map(canvas.moved.map((s, i) => [s, i]))
    return work.states.map((s) => {
      const c = canvas.colorOf[s]
      const wave = order.get(s)
      return {
        id: s,
        type: 'state',
        position: layout[s] ?? { x: 0, y: 0 },
        width: NODE_SIZE,
        height: NODE_SIZE,
        hidden: !visible.has(s),
        data: {
          label: s,
          start: work.start === s,
          final: finals.has(s),
          highlight: null,
          readOnly: true,
          dead: s === work.deadState,
          caption: dfaCaption(work, s),
          halo: ringed.has(s),
          tint: c === undefined ? undefined : blockColor(c),
          faded: faded.has(s),
          entering: live && canvas.entering === s,
          roleDelay: live && wave !== undefined ? recolourDelay(wave) : 0,
          motionMs: Math.round(600 / speed),
        },
      }
    })
  }, [work, layout, canvas, live, speed])

  const shown = useMemo(() => {
    const visible = new Set(canvas.visible)
    const transitions: DFA['transitions'] = {}
    for (const s of canvas.visible) {
      transitions[s] = {}
      for (const [sym, t] of Object.entries(work.transitions[s] ?? {})) if (visible.has(t)) transitions[s][sym] = t
    }
    return transitions
  }, [canvas.visible, work])
  const { merged, routes } = useMemo(() => dfaRoutes(work, layout, canvas.visible, shown), [work, layout, canvas.visible, shown])

  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    return merged.flatMap((e) => {
      const route = routes.get(e.id)
      if (!route) return []
      const hit = canvas.edges.find((w) => w.from === e.source && w.to === e.target && e.symbols.includes(w.symbol))
      const lit = !!hit
      const token = hit && live && frame.phase === 'witness' ? { label: hit.symbol, key: index, ms: tokenMs } : null
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
  }, [merged, routes, canvas.edges, live, frame.phase, index, tokenMs])

  // While the witness plays, the blocks are still the previous round's.
  const blocks = frame.phase === 'witness' ? (min.view.steps[index - 1]?.blocks ?? null) : step.blocks
  const subtitle = blocks ? `${blocks.length} block${blocks.length === 1 ? '' : 's'} · ${partitionText(blocks, 6)}` : `${canvas.visible.length} states`
  return (
    <Pane
      title="DFA"
      subtitle={subtitle}
      nodes={nodes}
      edges={edges}
      fitKey={work.states.join(',')}
      stateCount={work.states.length}
      fitMode="whole"
      legend={canvas.ringed.length > 0 ? <WitnessLegend /> : undefined}
    />
  )
}

/** The minimal DFA, each state in the colour of the block it came from. */
function MinPane({ view }: { view: MinimizeView }) {
  const dfa = view.result.dfa
  const captions = useMemo(() => minCaptions(dfa), [dfa])
  const layout = useMemo(() => layoutDFA(dfa, captions), [dfa, captions])
  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const finals = new Set(dfa.finals)
    return dfa.states.map((s) => ({
      id: s,
      type: 'state',
      position: layout[s] ?? { x: 0, y: 0 },
      width: NODE_SIZE,
      height: NODE_SIZE,
      data: {
        label: minStateLabel(s).label,
        start: dfa.start === s,
        final: finals.has(s),
        highlight: null,
        readOnly: true,
        dead: s === dfa.deadState,
        caption: captions[s],
        tint: blockColor(view.minColors[s] ?? 0),
      },
    }))
  }, [dfa, layout, captions, view.minColors])
  const { merged, routes } = useMemo(() => dfaRoutes(dfa, layout, dfa.states, dfa.transitions, captions), [dfa, layout, captions])
  const edges = useMemo<Edge<TransitionEdgeData>[]>(
    () =>
      merged.flatMap((e) => {
        const route = routes.get(e.id)
        if (!route) return []
        return [
          {
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'transition',
            markerEnd: arrow(EDGE_COLOR.normal),
            data: { route, symbols: e.symbols, epsilonOnly: false, highlight: null },
          },
        ]
      }),
    [merged, routes],
  )
  return (
    <Pane
      title="Minimal DFA"
      subtitle={`${dfa.states.length} state${dfa.states.length === 1 ? '' : 's'} (was ${view.input.states.length})${view.alreadyMinimal ? ' · already minimal' : ''}`}
      nodes={nodes}
      edges={edges}
      fitKey={dfa.states.join(',')}
      stateCount={dfa.states.length}
      fitMode="whole"
    />
  )
}

/** Canvas for DFAs too large to draw: every round as a row of a table, the current one marked. */
function RoundsTable({ state }: { state: MinimizeViewState }) {
  const jump = useMinimize((s) => s.jump)
  const { view } = state.min
  return (
    <div className="h-full overflow-auto bg-slate-50 p-5">
      <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Refinement rounds</h3>
          <p className="mt-0.5 text-xs text-pretty text-slate-600">
            {view.work.states.length.toLocaleString()} states are too many to draw, so the rounds are listed as a table. Pick a row to show it on the right.
          </p>
        </div>
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-20" />
            <col className="w-20" />
            <col />
          </colgroup>
          <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Step
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Blocks
              </th>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                What happens
              </th>
            </tr>
          </thead>
          <tbody>
            {view.steps.map((s, i) => {
              const on = i === state.index
              return (
                <tr key={i} aria-current={on ? 'step' : undefined} className={`border-t border-slate-100 ${on ? 'bg-blue-50' : ''}`}>
                  <th scope="row" className="px-3 py-2 text-left align-top font-normal">
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      className={`rounded px-1.5 py-0.5 font-mono font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-500 ${on ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-100'}`}
                    >
                      {s.pill}
                    </button>
                  </th>
                  <td className="px-3 py-2 text-right align-top font-mono text-slate-800 tabular-nums">{s.blocks ? s.blocks.length.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 align-top text-pretty text-slate-700">
                    <span className="line-clamp-3 break-words">{s.text}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Minimize-mode canvas: the DFA coloured by blocks round by round, then the original and the minimal DFA together. */
export function MinimizeCanvas() {
  useMinimizeClock()
  const state = useMinimizeView()
  const done = state?.step.kind === 'done'
  const view = state?.min.view
  const boxes = useMemo(() => {
    if (!view || view.large) return [null, null] as [null, null]
    const work = view.work
    const minDfa = view.result.dfa
    const caps = minCaptions(minDfa)
    return [roughBox(layoutDFA(work), work.start, dfaCaptions(work)), roughBox(layoutDFA(minDfa, caps), minDfa.start, caps)] as const
  }, [view])
  if (!state || !view) return <NotConvertible />
  if (view.large) return <RoundsTable state={state} />
  return (
    <div className="flex h-full flex-col">
      {done ? (
        <CanvasBar tab="minimize" labels={['DFA', 'Minimal DFA']} />
      ) : (
        <div className="flex h-10 shrink-0 items-center border-b border-slate-200 bg-white px-4 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{state.step.title}</span>
          <span className="ml-2 truncate text-slate-500">The minimal DFA appears next to the original at the last step.</span>
        </div>
      )}
      {done ? (
        <SplitPanes
          tab="minimize"
          boxes={[boxes[0], boxes[1]]}
          first={
            <ReactFlowProvider key="work">
              <WorkPane state={state} />
            </ReactFlowProvider>
          }
          second={
            <ReactFlowProvider key="min">
              <MinPane view={view} />
            </ReactFlowProvider>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ReactFlowProvider key="work">
            <WorkPane state={state} />
          </ReactFlowProvider>
        </div>
      )}
    </div>
  )
}
