import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, Handle, Position, useStore, type EdgeProps, type NodeProps } from 'reactflow'
import { NODE_SIZE } from '../../graph/layout'
import type { Route } from '../../graph/routing'

export interface StateNodeData {
  label: string
  start: boolean
  final: boolean
}

export interface TransitionEdgeData {
  route: Route
  label: string
  epsilonOnly: boolean
}

const connectingSelector = (s: { connectionNodeId: string | null }) => s.connectionNodeId

/**
 * A state drawn as a circle: a double ring when final, an incoming arrow when
 * it is the start state. Drag from the small dot on the right to another
 * state to add a transition; while dragging, every state becomes a drop
 * target.
 */
export const StateNode = memo(function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const connecting = useStore(connectingSelector) !== null
  const long = data.label.length > 3
  return (
    <div className="group relative" style={{ width: NODE_SIZE, height: NODE_SIZE }}>
      {data.start && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500"
          style={{ left: -34 }}
          width="32"
          height="12"
          viewBox="0 0 32 12"
        >
          <path d="M0 6h24" stroke="currentColor" strokeWidth="1.75" />
          <path d="M23 1.5L31 6l-8 4.5z" fill="currentColor" />
        </svg>
      )}
      <div
        className={`grid size-full place-items-center rounded-full border-[1.75px] bg-white transition-[box-shadow,border-color] duration-150 ${
          selected ? 'border-accent-600 shadow-[0_0_0_4px_var(--color-accent-100)]' : 'border-slate-700 shadow-sm'
        }`}
      >
        {data.final && (
          <div
            aria-hidden="true"
            className={`absolute inset-[4px] rounded-full border-[1.5px] ${selected ? 'border-accent-600' : 'border-slate-700'}`}
          />
        )}
        <span
          className={`relative max-w-[40px] truncate font-semibold text-slate-900 tabular-nums ${long ? 'text-[11px]' : 'text-[14px]'}`}
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
        className="!size-3 !rounded-full !border-2 !border-white !bg-accent-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      />
    </div>
  )
})

/** A merged transition edge with its label; ε-only edges are dashed. */
export const TransitionEdge = memo(function TransitionEdge({ id, data, markerEnd, selected }: EdgeProps<TransitionEdgeData>) {
  if (!data) return null
  const color = selected ? 'var(--color-accent-600)' : 'var(--color-slate-500)'
  return (
    <>
      <BaseEdge
        id={id}
        path={data.route.path}
        markerEnd={markerEnd}
        interactionWidth={14}
        style={{ stroke: color, strokeWidth: 1.6, strokeDasharray: data.epsilonOnly ? '5 4' : undefined }}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-none absolute rounded-md px-1.5 py-px text-[12px] leading-[18px] font-semibold whitespace-nowrap ring-1 ${
            data.epsilonOnly ? 'bg-accent-50 text-accent-700 ring-accent-100' : 'bg-white text-slate-700 ring-slate-200'
          }`}
          style={{ transform: `translate(-50%, -50%) translate(${data.route.labelX}px, ${data.route.labelY}px)` }}
        >
          {data.label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})
