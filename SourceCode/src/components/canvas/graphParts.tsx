import { Fragment, memo, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { BaseEdge, EdgeLabelRenderer, Handle, Position, useStore, type EdgeProps, type NodeProps } from 'reactflow'
import { EPSILON } from '../../core'
import { NODE_SIZE } from '../../graph/layout'
import type { Route } from '../../graph/routing'
import { EDGE_COLOR } from './colors'

/** Font size of edge labels, in px at zoom 1. */
export const LABEL_FONT = 13
/**
 * Lowest zoom the canvases allow: edge labels never render below 12px and
 * state circles never below ~52px. Bigger machines pan instead of shrinking.
 */
export const MIN_ZOOM = 12 / LABEL_FONT

/** Roles a state can play in the Convert animation. */
export interface StateRole {
  /** In the set S being expanded: drawn filled. */
  current?: boolean
  /** In move(S, a): drawn outlined. */
  moved?: boolean
  /** In the ε-closure being built: drawn in violet. */
  closure?: boolean
}

export interface StateNodeData {
  label: string
  start: boolean
  final: boolean
  /** Set while a transition-table cell is hovered: the cell's state, or one of its targets. */
  highlight: 'source' | 'target' | null
  /** Convert-mode highlight. */
  role?: StateRole
  /** Delay before `role` changes show, in ms (lets a token arrive first). */
  roleDelay?: number
  /** Changes whenever the state should pulse; `0` means no pulse. */
  pulse?: number
  /** Changes whenever the state should flash (an existing DFA state was reached). */
  flash?: number
  /** True while the state grows in. */
  entering?: boolean
  /** Small text under the circle, e.g. the NFA subset of a DFA state. */
  caption?: string
  /** The DFA dead state: drawn dashed and muted. */
  dead?: boolean
  /** Hide the drag-to-connect handle (read-only graphs). */
  readOnly?: boolean
  /** Animation length for pulse, flash and grow, in ms. */
  motionMs?: number
}

/** A token travelling along an edge during the move(S, a) micro-step. */
export interface EdgeToken {
  label: string
  /** Changes to restart the token. */
  key: number
  ms: number
}

export interface TransitionEdgeData {
  route: Route
  symbols: string[]
  epsilonOnly: boolean
  /** Symbol of the hovered table cell when this edge carries it. */
  highlight: string | null
  /** Convert mode: this edge is used by the current step. */
  lit?: boolean
  /** Convert mode: a token travels along the edge. */
  token?: EdgeToken | null
  /** Convert mode: the edge draws itself in; `key` changes to replay. */
  draw?: { key: number; ms: number } | null
}

const connectingSelector = (s: { connectionNodeId: string | null }) => s.connectionNodeId

function nodeLook(data: StateNodeData, selected: boolean): { border: string; fill: string; text: string } {
  const r = data.role
  if (r?.current) return { border: 'border-blue-700', fill: 'bg-blue-600', text: 'text-white' }
  if (r?.closure) return { border: 'border-violet-600', fill: 'bg-violet-100', text: 'text-violet-950' }
  if (data.highlight === 'source') return { border: 'border-blue-600', fill: 'bg-blue-50', text: 'text-blue-900' }
  if (data.highlight === 'target' || selected) return { border: 'border-blue-600', fill: 'bg-white', text: 'text-blue-900' }
  if (data.dead) return { border: 'border-slate-400 border-dashed', fill: 'bg-slate-50', text: 'text-slate-500' }
  return { border: 'border-slate-900', fill: 'bg-white', text: 'text-slate-900' }
}

/**
 * A state drawn as a 56px circle: a double ring when final, an incoming
 * "start" arrow touching its border when it is the start state. Drag from the
 * small dot on the right to another state to add a transition; while
 * dragging, every state becomes a drop target. In Convert mode the circle is
 * filled, outlined or tinted by its role, pulses, flashes or grows in.
 */
export const StateNode = memo(function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const connecting = useStore(connectingSelector) !== null
  const size = data.label.length > 4 ? 10 : data.label.length > 2 ? 12 : 14
  const look = nodeLook(data, selected)
  const moved = !!data.role?.moved
  const shadow = moved
    ? '0 0 0 3px #fff, 0 0 0 6px #2563eb'
    : data.highlight === 'source'
      ? '0 0 0 4px rgb(37 99 235 / 0.18)'
      : data.highlight === 'target'
        ? '0 0 0 3px rgb(37 99 235 / 0.12)'
        : selected
          ? '0 0 0 3px rgb(37 99 235 / 0.14)'
          : '0 1px 4px rgb(15 23 42 / 0.08)'
  const motion = { '--motion-ms': `${data.motionMs ?? 600}ms` } as CSSProperties
  const delay = { '--role-delay': `${data.roleDelay ?? 0}ms` } as CSSProperties
  return (
    <div className={`group relative ${data.entering ? 'node-enter' : ''}`} style={{ width: NODE_SIZE, height: NODE_SIZE, ...motion }}>
      {data.start && (
        <div aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={{ left: -46, width: 46, height: 28 }}>
          <span className="absolute -top-1.5 left-0.5 text-[10px] font-semibold tracking-wide text-slate-600 select-none">start</span>
          <svg width="46" height="28" viewBox="0 0 46 28" className="overflow-visible text-slate-900">
            <line x1="4" y1="14" x2="38" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <polygon points="46,14 36,9.5 36,18.5" fill="currentColor" />
          </svg>
        </div>
      )}
      {!!data.pulse && <span key={`p${data.pulse}`} aria-hidden="true" className="state-pulse pointer-events-none absolute inset-0 rounded-full" />}
      {!!data.flash && <span key={`f${data.flash}`} aria-hidden="true" className="state-flash pointer-events-none absolute inset-0 rounded-full" />}
      <div
        className={`state-circle relative grid size-full place-items-center rounded-full border-[1.8px] ${look.border} ${look.fill}`}
        style={{ boxShadow: shadow, ...delay }}
      >
        {data.final && <div aria-hidden="true" className={`absolute inset-[4px] rounded-full border-[1.6px] ${look.border}`} />}
        <span
          className={`relative max-w-[44px] truncate font-mono font-semibold tracking-tight select-none ${look.text}`}
          style={{ fontSize: size }}
          title={data.label}
        >
          {data.label}
        </span>
      </div>
      {data.caption && (
        <span
          className="pointer-events-none absolute top-full left-1/2 mt-1.5 max-w-40 -translate-x-1/2 truncate rounded bg-white/90 px-1 font-mono text-[13px] leading-tight whitespace-nowrap text-slate-600 select-none"
          title={data.caption}
        >
          {data.caption}
        </span>
      )}
      {!data.readOnly && (
        <>
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
        </>
      )}
      {data.readOnly && (
        <>
          <Handle type="target" position={Position.Left} isConnectable={false} className="!pointer-events-none !opacity-0" />
          <Handle type="source" position={Position.Right} isConnectable={false} className="!pointer-events-none !opacity-0" />
        </>
      )}
    </div>
  )
})

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * A small symbol token that travels along an edge path. The path is sampled
 * once and the token moves by `transform` only, so it stays on the
 * compositor. With reduced motion the token is not drawn at all.
 */
function Token({ path, token, color }: { path: string; token: EdgeToken; color: string }) {
  const guide = useRef<SVGPathElement>(null)
  const dot = useRef<SVGGElement>(null)
  useLayoutEffect(() => {
    const p = guide.current
    const g = dot.current
    if (!p || !g || reducedMotion()) return
    const len = p.getTotalLength()
    const n = 24
    const frames: Keyframe[] = []
    for (let i = 0; i <= n; i++) {
      const pt = p.getPointAtLength((len * i) / n)
      frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)`, opacity: i === 0 ? 0 : i === n ? 0 : 1, offset: i / n })
    }
    frames[1].opacity = 1
    const anim = g.animate(frames, { duration: token.ms, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' })
    return () => anim.cancel()
  }, [path, token.key, token.ms])
  return (
    <>
      <path ref={guide} d={path} fill="none" stroke="none" />
      <g ref={dot} style={{ opacity: 0 }} aria-hidden="true">
        <circle r={11} fill={color} stroke="#fff" strokeWidth={2} />
        <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="#fff" style={{ fontFamily: 'var(--font-mono)' }}>
          {token.label}
        </text>
      </g>
    </>
  )
}

/** A merged transition edge with a pill label; ε-edges are dashed violet. */
export const TransitionEdge = memo(function TransitionEdge({ id, data, markerEnd, selected }: EdgeProps<TransitionEdgeData>) {
  if (!data) return null
  const hover = data.highlight !== null || selected
  const lit = hover || !!data.lit
  const color = data.lit && data.epsilonOnly ? EDGE_COLOR.epsilon : lit ? EDGE_COLOR.highlight : data.epsilonOnly ? EDGE_COLOR.epsilon : EDGE_COLOR.normal
  const style: CSSProperties = {
    stroke: color,
    strokeWidth: lit ? 2.6 : 1.65,
    strokeDasharray: data.epsilonOnly ? '5 4' : undefined,
    strokeLinecap: 'round',
    transition: 'stroke 150ms ease, stroke-width 150ms ease',
  }
  const pill = data.lit
    ? data.epsilonOnly
      ? 'border-violet-600 bg-violet-50'
      : 'border-blue-600 bg-blue-50'
    : hover
      ? 'border-blue-600 bg-blue-50'
      : data.epsilonOnly
        ? 'border-violet-300 bg-white'
        : 'border-slate-300 bg-white'
  return (
    <>
      {data.draw ? (
        <path
          key={data.draw.key}
          id={id}
          d={data.route.path}
          fill="none"
          markerEnd={markerEnd}
          pathLength={1}
          className="edge-draw react-flow__edge-path"
          style={{ ...style, strokeDasharray: 1, ['--draw-ms' as string]: `${data.draw.ms}ms` }}
        />
      ) : (
        <BaseEdge id={id} path={data.route.path} markerEnd={markerEnd} interactionWidth={14} style={style} />
      )}
      {data.token && <Token path={data.route.path} token={data.token} color={EDGE_COLOR.highlight} />}
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-none absolute flex items-center rounded-full border px-2 py-px font-mono font-semibold whitespace-nowrap shadow-[0_1px_3px_rgb(15_23_42/0.08)] transition-colors duration-150 ${pill}`}
          style={{
            fontSize: LABEL_FONT,
            transform: `translate(-50%, -50%) translate(${data.route.labelX}px, ${data.route.labelY}px)`,
            zIndex: lit ? 20 : 10,
          }}
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
