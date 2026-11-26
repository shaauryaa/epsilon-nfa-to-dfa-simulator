import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
import { addState, addTransition, setFinal, setStart } from '../../model/edits'
import { mergedEdges } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { CheckIcon, FitIcon, LayoutIcon, MapIcon, PlusIcon } from '../ui/Icons'
import { Popover } from '../ui/Popover'
import { EDGE_COLOR } from './colors'
import { arrow, FIT, fitReadable, MINIMAP_MIN_STATES, routeAll } from './flow'
import { MIN_ZOOM, StateNode, TransitionEdge, type StateNodeData, type TransitionEdgeData } from './graphParts'

const nodeTypes = { state: StateNode }
const edgeTypes = { transition: TransitionEdge }
const R = NODE_SIZE / 2

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
        Add transition <span className="font-mono font-semibold text-slate-800">{pending.source}</span> →{' '}
        <span className="font-mono font-semibold text-slate-800">{pending.target}</span> on
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
              className={`press inline-flex h-8 min-w-9 items-center justify-center gap-1 rounded-md border px-2.5 font-mono text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default ${
                sym === EPSILON
                  ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
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

/** Right-click menu for a state: set it as the start state or toggle final. */
function StateMenu({ menu, onClose }: { menu: { state: string; x: number; y: number } | null; onClose: () => void }) {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  if (!menu) return null
  const isStart = nfa.start === menu.state
  const isFinal = nfa.finals.includes(menu.state)
  const item =
    'press flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent'
  return (
    <Popover open anchor={{ x: menu.x, y: menu.y }} onClose={onClose} label={`State ${menu.state}`} width={190}>
      <p className="mb-1 px-2 font-mono text-xs font-semibold text-slate-500">{menu.state}</p>
      <div role="menu" aria-label={`State ${menu.state}`} className="flex flex-col">
        <button
          type="button"
          role="menuitem"
          autoFocus
          disabled={isStart}
          className={item}
          onClick={() => {
            commit(setStart(useApp.getState().nfa, menu.state), 'graph')
            onClose()
          }}
        >
          <span className="w-4 text-blue-600">{isStart && <CheckIcon size={14} />}</span>
          Set as start
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={isFinal}
          className={item}
          onClick={() => {
            commit(setFinal(useApp.getState().nfa, menu.state, !isFinal), 'graph')
            onClose()
          }}
        >
          <span className="w-4 text-emerald-600">{isFinal && <CheckIcon size={14} />}</span>
          Toggle final
        </button>
      </div>
    </Popover>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <span className="flex items-center gap-1.5">
        <span className="font-bold text-slate-800">→</span> Start
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-grid size-3.5 place-items-center rounded-full border border-slate-700">
          <span className="size-2 rounded-full border border-slate-700" />
        </span>
        Final
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="4" aria-hidden="true">
          <line x1="0" y1="2" x2="18" y2="2" stroke={EDGE_COLOR.epsilon} strokeWidth="1.8" strokeDasharray="4 3" />
        </svg>
        <span>
          <span className="font-mono text-violet-700">ε</span>-move
        </span>
      </span>
    </div>
  )
}

export const toolButton =
  'press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500 aria-pressed:bg-slate-100 aria-pressed:text-slate-900'

/** Mini map in the canvas corner, coloured like the states. */
export function CanvasMiniMap() {
  return (
    <MiniMap
      position="bottom-right"
      pannable
      zoomable
      ariaLabel="Mini map"
      nodeColor={(n) => {
        const d = n.data as StateNodeData
        if (d.final) return '#16a34a'
        if (d.start) return '#334155'
        return '#94a3b8'
      }}
      maskColor="rgb(15 23 42 / 0.08)"
      style={{ background: '#fff', width: 160, height: 110 }}
    />
  )
}

/** Toolbar toggle for the mini map. */
export function MapToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={toolButton} aria-pressed={on} onClick={onToggle} title={on ? 'Hide the mini map' : 'Show the mini map'}>
      <MapIcon size={13} /> Map
    </button>
  )
}

/**
 * Interactive state diagram. Positions come from the store (dagre layout,
 * then wherever the user drags them); edges are re-routed on every move so
 * they stay clear of other states. A hovered transition-table cell is
 * highlighted here.
 */
export function GraphView() {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const layoutNonce = useApp((s) => s.layoutNonce)
  const hoverCell = useApp((s) => s.hoverCell)
  const setPosition = useApp((s) => s.setPosition)
  const relayout = useApp((s) => s.relayout)
  const commit = useApp((s) => s.commit)
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)
  const pendingConnection = useRef<Connection | null>(null)
  const [pending, setPending] = useState<PendingTransition | null>(null)
  const [menu, setMenu] = useState<{ state: string; x: number; y: number } | null>(null)

  // Positions while a drag is in progress, and the selection. Everything else comes from the store.
  const [dragging, setDragging] = useState<Record<string, XY>>({})
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [mapChoice, setMapChoice] = useState<boolean | null>(null)
  const showMap = mapChoice ?? nfa.states.length >= MINIMAP_MIN_STATES

  const lit = useMemo(() => {
    if (!hoverCell) return null
    return { source: hoverCell.state, symbol: hoverCell.symbol, targets: new Set(nfa.transitions[hoverCell.state]?.[hoverCell.symbol] ?? []) }
  }, [hoverCell, nfa])

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
      data: {
        label: s,
        start: nfa.start === s,
        final: finals.has(s),
        highlight: lit?.source === s ? 'source' : lit?.targets.has(s) ? 'target' : null,
      },
    }))
  }, [nfa, positions, dragging, selected, lit])

  const merged = useMemo(() => mergedEdges(nfa), [nfa])
  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const centre = new Map<string, XY>(nodes.map((n) => [n.id, { x: n.position.x + R, y: n.position.y + R }]))
    const routes = routeAll(merged, centre)
    return merged.flatMap((e) => {
      const route = routes.get(e.id)
      if (!route) return []
      const highlight = lit && lit.source === e.source && e.symbols.includes(lit.symbol) ? lit.symbol : null
      const color = highlight ? EDGE_COLOR.highlight : e.epsilonOnly ? EDGE_COLOR.epsilon : EDGE_COLOR.normal
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'transition',
          markerEnd: arrow(color),
          zIndex: highlight ? 1 : 0,
          data: {
            route,
            symbols: e.symbols,
            epsilonOnly: e.epsilonOnly,
            highlight,
          },
        },
      ]
    })
  }, [merged, nodes, lit])

  // Re-fit after a preset load, import or re-layout.
  useEffect(() => {
    const id = requestAnimationFrame(() => fitReadable(rf, wrapper.current))
    return () => cancelAnimationFrame(id)
  }, [layoutNonce, rf])

  // Re-fit when the canvas changes size (window resize, moving to a projector).
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
      frame = requestAnimationFrame(() => fitReadable(rf, wrapper.current))
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

  /** Adds a state centred on `at` (flow coordinates), nudged down until it overlaps nothing. */
  const addStateAt = (at: XY) => {
    const { nfa: next, name } = addState(useApp.getState().nfa)
    commit(next, 'graph')
    const taken = Object.entries(useApp.getState().positions)
      .filter(([id]) => id !== name)
      .map(([, p]) => p)
    const spot = { x: Math.round(at.x - R), y: Math.round(at.y - R) }
    while (taken.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) < NODE_SIZE + 12)) spot.y += NODE_SIZE + 24
    setPosition(name, spot)
  }

  const onAddState = () => {
    const box = wrapper.current?.getBoundingClientRect()
    if (!box) return addStateAt({ x: 0, y: 0 })
    addStateAt(rf.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 }))
  }

  const onDoubleClick = (e: ReactMouseEvent) => {
    if (!(e.target as HTMLElement).closest('.react-flow__pane')) return
    addStateAt(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }

  return (
    <div ref={wrapper} className="relative h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={(e, node) => {
          e.preventDefault()
          setMenu({ state: node.id, x: e.clientX, y: e.clientY })
        }}
        onDoubleClick={onDoubleClick}
        zoomOnDoubleClick={false}
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
        connectionLineStyle={{ stroke: EDGE_COLOR.highlight, strokeWidth: 1.6 }}
        deleteKeyCode={null}
        onInit={(inst) => requestAnimationFrame(() => fitReadable(inst, wrapper.current))}
        minZoom={MIN_ZOOM}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#cbd5e1" />
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={FIT} onFitView={() => fitReadable(rf, wrapper.current)} />
        {showMap && <CanvasMiniMap />}
        <Panel position="top-right" className="!m-3">
          <div role="toolbar" aria-label="Canvas" className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" className={toolButton} onClick={onAddState} title="Add a state (or double-click the canvas)">
              <PlusIcon size={13} className="text-blue-600" /> State
            </button>
            <span aria-hidden="true" className="h-4 w-px bg-slate-200" />
            <button type="button" className={toolButton} onClick={relayout} title="Arrange the states left to right">
              <LayoutIcon size={13} /> Re-layout
            </button>
            <button type="button" className={toolButton} onClick={() => fitReadable(rf, wrapper.current, { duration: 250 })} title="Fit the diagram to the canvas">
              <FitIcon size={13} /> Fit
            </button>
            <MapToggle on={showMap} onToggle={() => setMapChoice(!showMap)} />
          </div>
        </Panel>
        <Panel position="bottom-left" className="!mb-[15px] !ml-[52px]">
          <Legend />
        </Panel>
        {nfa.states.length === 0 && (
          <Panel position="top-center">
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-4 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">The canvas is empty</p>
              <p className="mt-1 text-xs text-slate-500">
                Double-click anywhere to place a state, click <strong className="text-slate-700">State</strong>, or load an example.
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>
      <SymbolMenu pending={pending} onClose={() => setPending(null)} />
      <StateMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}
