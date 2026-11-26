import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeSelectionChange,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { EPSILON } from '../../core'
import { NODE_SIZE, type XY } from '../../graph/layout'
import { routeEdge } from '../../graph/routing'
import { addState, addTransition } from '../../model/edits'
import { mergedEdges } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { Button } from '../ui/Button'
import { CheckIcon, LayoutIcon, PlusIcon } from '../ui/Icons'
import { Popover } from '../ui/Popover'
import { StateNode, TransitionEdge, type StateNodeData, type TransitionEdgeData } from './graphParts'

const nodeTypes = { state: StateNode }
const edgeTypes = { transition: TransitionEdge }
const R = NODE_SIZE / 2
const marker = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#64748b' }

interface PendingTransition {
  source: string
  target: string
  x: number
  y: number
}

function SymbolMenu({ pending, onClose }: { pending: PendingTransition | null; onClose: () => void }) {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  if (!pending) return null
  const existing = new Set(
    Object.entries(nfa.transitions[pending.source] ?? {})
      .filter(([, targets]) => targets.includes(pending.target))
      .map(([sym]) => sym),
  )
  const choose = (sym: string) => {
    commit(addTransition(nfa, pending.source, sym, pending.target), 'graph')
    onClose()
  }
  return (
    <Popover open anchor={{ x: pending.x, y: pending.y }} onClose={onClose} label="Choose a symbol" width={240}>
      <p className="mb-2.5 text-xs font-medium text-slate-500">
        Add transition <span className="font-semibold text-slate-800">{pending.source}</span> →{' '}
        <span className="font-semibold text-slate-800">{pending.target}</span> on
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[...nfa.alphabet, EPSILON].map((sym, i) => {
          const has = existing.has(sym)
          return (
            <button
              key={`${sym}-${i}`}
              type="button"
              autoFocus={i === 0}
              disabled={has}
              title={has ? 'Already present' : undefined}
              onClick={() => choose(sym)}
              className={`press inline-flex h-8 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent-500 disabled:cursor-default ${
                sym === EPSILON
                  ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              } ${has ? 'opacity-60' : ''}`}
            >
              {has && <CheckIcon size={13} />}
              {sym}
            </button>
          )
        })}
      </div>
    </Popover>
  )
}

/**
 * Interactive state diagram. Positions come from the store (dagre layout,
 * then wherever the user drags them); edges are re-routed on every move so
 * they stay clear of other states.
 */
export function GraphView() {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const layoutNonce = useApp((s) => s.layoutNonce)
  const setPosition = useApp((s) => s.setPosition)
  const relayout = useApp((s) => s.relayout)
  const commit = useApp((s) => s.commit)
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)
  const pendingConnection = useRef<Connection | null>(null)
  const [pending, setPending] = useState<PendingTransition | null>(null)

  // Positions while a drag is in progress, and the selection. Everything else comes from the store.
  const [dragging, setDragging] = useState<Record<string, XY>>({})
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const nodes = useMemo<Node<StateNodeData>[]>(() => {
    const finals = new Set(nfa.finals)
    const unique = [...new Set(nfa.states)]
    return unique.map((s) => ({
      id: s,
      type: 'state',
      position: dragging[s] ?? positions[s] ?? { x: 0, y: 0 },
      width: NODE_SIZE,
      height: NODE_SIZE,
      selected: selected.has(s),
      data: { label: s, start: nfa.start === s, final: finals.has(s) },
    }))
  }, [nfa, positions, dragging, selected])

  const merged = useMemo(() => mergedEdges(nfa), [nfa])
  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const centre = new Map<string, XY>(nodes.map((n) => [n.id, { x: n.position.x + R, y: n.position.y + R }]))
    return merged.flatMap((e) => {
      const source = centre.get(e.source)
      const target = centre.get(e.target)
      if (!source || !target) return []
      const obstacles = [...centre.entries()].filter(([id]) => id !== e.source && id !== e.target).map(([, p]) => p)
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'transition',
          markerEnd: marker,
          data: {
            route: routeEdge({ source, target, loop: e.loop, hasReverse: e.hasReverse, obstacles, radius: R }),
            label: e.label,
            epsilonOnly: e.epsilonOnly,
          },
        },
      ]
    })
  }, [merged, nodes])

  // Re-fit after a preset load, import or re-layout.
  useEffect(() => {
    const id = requestAnimationFrame(() => rf.fitView({ padding: 0.12, maxZoom: 1.25 }))
    return () => cancelAnimationFrame(id)
  }, [layoutNonce, rf])

  // Re-fit when the panel changes size (window resize, moving to a projector).
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
      frame = requestAnimationFrame(() => rf.fitView({ padding: 0.12, maxZoom: 1.25 }))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [rf])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const moved: Record<string, XY> = {}
    for (const c of changes) if (c.type === 'position' && c.position) moved[c.id] = c.position
    if (Object.keys(moved).length > 0) setDragging((d) => ({ ...d, ...moved }))

    const picks = changes.filter((c): c is NodeSelectionChange => c.type === 'select')
    if (picks.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const c of picks) {
          if (c.selected) next.add(c.id)
          else next.delete(c.id)
        }
        return next
      })
    }
  }, [])

  const onNodeDragStop = useCallback(
    (_: unknown, __: unknown, dragged: Node[]) => {
      dragged.forEach((n) => setPosition(n.id, n.position))
      setDragging({})
    },
    [setPosition],
  )

  const onAddState = () => {
    const { nfa: next, name } = addState(useApp.getState().nfa)
    commit(next, 'graph')
    const box = wrapper.current?.getBoundingClientRect()
    if (!box) return
    const centre = rf.project({ x: box.width / 2, y: box.height / 2 })
    const taken = Object.values(useApp.getState().positions)
    const spot = { x: Math.round(centre.x - R), y: Math.round(centre.y - R) }
    while (taken.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) < NODE_SIZE + 12)) spot.y += NODE_SIZE + 24
    setPosition(name, spot)
  }

  return (
    <div ref={wrapper} className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={(c) => {
          pendingConnection.current = c
        }}
        onConnectEnd={(event) => {
          const c = pendingConnection.current
          pendingConnection.current = null
          if (!c?.source || !c.target) return
          const point = 'changedTouches' in event ? event.changedTouches[0] : event
          setPending({ source: c.source, target: c.target, x: point.clientX, y: point.clientY })
        }}
        isValidConnection={() => true}
        connectionLineStyle={{ stroke: 'var(--color-accent-600)', strokeWidth: 1.6 }}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.25 }}
        minZoom={0.25}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d7dce3" />
        <Controls showInteractive={false} position="bottom-right" />
        <Panel position="top-left" className="!m-3 flex gap-2">
          <Button size="sm" onClick={onAddState}>
            <PlusIcon size={14} /> Add state
          </Button>
          <Button size="sm" onClick={relayout} title="Arrange the states left to right">
            <LayoutIcon size={14} /> Re-layout
          </Button>
        </Panel>
        <Panel position="bottom-left" className="!m-3 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-500 backdrop-blur">
          Drag a state to move it · drag from its blue dot to another state to add a transition
        </Panel>
      </ReactFlow>
      {nfa.states.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-500">
          Add a state to start drawing.
        </div>
      )}
      <SymbolMenu pending={pending} onClose={() => setPending(null)} />
    </div>
  )
}
