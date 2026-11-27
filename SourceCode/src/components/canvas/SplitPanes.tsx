import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Rect } from '../../graph/routing'
import { chooseSplit } from '../../model/viewport'
import { usePanes, type PaneView, type SplitTab } from '../../store/panes'

/** The segmented control that picks which graph(s) the canvas shows. */
export function PaneSwitch({ tab, labels }: { tab: SplitTab; labels: [string, string] }) {
  const view = usePanes((s) => s.views[tab])
  const setView = usePanes((s) => s.setView)
  const options: { id: PaneView; label: string }[] = [
    { id: 'first', label: labels[0] },
    { id: 'second', label: labels[1] },
    { id: 'both', label: 'Both' },
  ]
  return (
    <div role="group" aria-label="Show" className="flex items-center gap-2">
      <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Show</span>
      <div className="flex rounded-lg bg-slate-100 p-0.5">
        {options.map((o) => {
          const on = view === o.id
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setView(tab, o.id)}
              className={`press rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-blue-500 ${
                on ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.12)]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A thin strip above the canvas with the pane switch and optional content on the right. */
export function CanvasBar({ tab, labels, children }: { tab: SplitTab; labels: [string, string]; children?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3">
      <PaneSwitch tab={tab} labels={labels} />
      {children && <div className="min-w-0 truncate text-xs text-slate-500">{children}</div>}
    </div>
  )
}

/**
 * Lays out one or two panes. With both shown, they sit side by side or one
 * above the other, whichever lets the smaller graph fit at the larger zoom
 * (see `chooseSplit`); the choice follows the canvas size.
 */
export function SplitPanes({ tab, first, second, boxes }: { tab: SplitTab; first: ReactNode; second: ReactNode; boxes: [Rect | null, Rect | null] }) {
  const view = usePanes((s) => s.views[tab])
  const el = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const node = el.current
    if (!node) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  const dir = chooseSplit(boxes[0], boxes[1], size.w, size.h)
  return (
    <div
      ref={el}
      data-split={view === 'both' ? dir : view}
      className={`flex min-h-0 flex-1 ${dir === 'rows' && view === 'both' ? 'flex-col divide-y' : 'flex-row divide-x'} divide-slate-200`}
    >
      {view !== 'second' && first}
      {view !== 'first' && second}
    </div>
  )
}
