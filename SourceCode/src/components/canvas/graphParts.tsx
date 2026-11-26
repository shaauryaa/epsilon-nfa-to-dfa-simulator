import { Fragment, memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, Handle, Position, useStore, type EdgeProps, type NodeProps } from 'reactflow'
import { EPSILON } from '../../core'
import { NODE_SIZE } from '../../graph/layout'
import type { Route } from '../../graph/routing'
import { EDGE_COLOR } from './colors'

export interface StateNodeData {
  label: string
  start: boolean
  final: boolean
  /** Set while a transition-table cell is hovered: the cell's state, or one of its targets. */
  highlight: 'source' | 'target' | null
}

export interface TransitionEdgeData {
  route: Route
  symbols: string[]
  epsilonOnly: boolean
  /** Symbol of the hovered table cell when this edge carries it. */
  highlight: string | null
}

const connectingSelector = (s: { connectionNodeId: string | null }) => s.connectionNodeId

/**
 * A state drawn as a 56px circle: a double ring when final, an incoming
 * "start" arrow touching its border when it is the start state. Drag from the
 * small dot on the right to another state to add a transition; while
 * dragging, every state becomes a drop target.
 */
export const StateNode = memo(function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const connecting = useStore(connectingSelector) !== null
  const size = data.label.length > 4 ? 10 : data.label.length > 2 ? 12 : 14
  const lit = data.highlight !== null
  const border = lit || selected ? 'border-blue-600' : 'border-slate-900'
  const ring =
    data.highlight === 'source'
      ? 'shadow-[0_0_0_4px_rgb(37_99_235/0.18)] bg-blue-50'
      : data.highlight === 'target'
        ? 'shadow-[0_0_0_3px_rgb(37_99_235/0.12)] bg-white'
        : selected
          ? 'shadow-[0_0_0_3px_rgb(37_99_235/0.14)] bg-white'
          : 'shadow-[0_1px_4px_rgb(15_23_42/0.08)] bg-white'
  return (
    <div className="group relative" style={{ width: NODE_SIZE, height: NODE_SIZE }}>
      {data.start && (
        <div aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={{ left: -46, width: 46, height: 28 }}>
          <span className="absolute -top-1.5 left-0.5 text-[10px] font-semibold tracking-wide text-slate-600 select-none">start</span>
          <svg width="46" height="28" viewBox="0 0 46 28" className="overflow-visible text-slate-900">
            <line x1="4" y1="14" x2="38" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <polygon points="46,14 36,9.5 36,18.5" fill="currentColor" />
          </svg>
        </div>
      )}
      <div
        className={`relative grid size-full place-items-center rounded-full border-[1.8px] transition-[box-shadow,border-color,background-color] duration-150 ${border} ${ring}`}
      >
        {data.final && <div aria-hidden="true" className={`absolute inset-[4px] rounded-full border-[1.6px] ${border}`} />}
        <span
          className={`relative max-w-[44px] truncate font-mono font-semibold tracking-tight select-none ${lit ? 'text-blue-900' : 'text-slate-900'}`}
          style={{ fontSize: size }}
          title={data.label}
        >
          {data.label}
        </span>
      </div>
      {/* Full-size drop target, active only while a connection is being dragged. */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        style={{
          inset: 0,
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: 'none',
          borderRadius: '9999px',
          background: 'transparent',
          opacity: 0,
          pointerEvents: connecting ? 'all' : 'none',
        }}
      />
      {/* Drag source: a small dot on the right edge, shown on hover. */}
      <Handle
        type="source"
        position={Position.Right}
        title="Drag to another state to add a transition"
        className="!size-2.5 !rounded-full !border-2 !border-white !bg-blue-600 opacity-0 !shadow-[0_1px_3px_rgb(15_23_42/0.2)] transition-opacity duration-150 group-hover:opacity-100"
      />
    </div>
  )
})

/** A merged transition edge with a pill label; ε-only edges are dashed violet. */
export const TransitionEdge = memo(function TransitionEdge({ id, data, markerEnd, selected }: EdgeProps<TransitionEdgeData>) {
  if (!data) return null
  const lit = data.highlight !== null || selected
  const color = lit ? EDGE_COLOR.highlight : data.epsilonOnly ? EDGE_COLOR.epsilon : EDGE_COLOR.normal
  return (
    <>
      <BaseEdge
        id={id}
        path={data.route.path}
        markerEnd={markerEnd}
        interactionWidth={14}
        style={{
          stroke: color,
          strokeWidth: lit ? 2.4 : 1.65,
          strokeDasharray: data.epsilonOnly ? '5 4' : undefined,
          strokeLinecap: 'round',
          transition: 'stroke 150ms ease, stroke-width 150ms ease',
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-none absolute flex items-center rounded-full border px-2 py-px font-mono text-xs font-semibold whitespace-nowrap shadow-[0_1px_3px_rgb(15_23_42/0.08)] ${
            lit ? 'border-blue-600 bg-blue-50' : data.epsilonOnly ? 'border-violet-300 bg-white' : 'border-slate-300 bg-white'
          }`}
          style={{ transform: `translate(-50%, -50%) translate(${data.route.labelX}px, ${data.route.labelY}px)`, zIndex: lit ? 20 : 10 }}
        >
          {data.symbols.map((s, i) => (
            <Fragment key={`${s}-${i}`}>
              {i > 0 && <span className="text-slate-400">,&nbsp;</span>}
              <span className={s === data.highlight ? 'font-bold text-blue-700' : s === EPSILON ? 'text-violet-700' : 'text-slate-900'}>{s}</span>
            </Fragment>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})
