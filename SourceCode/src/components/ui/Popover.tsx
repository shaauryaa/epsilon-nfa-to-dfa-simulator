import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PopoverProps {
  open: boolean
  onClose: () => void
  /** Element the popover hangs from, or a fixed viewport point. */
  anchor: HTMLElement | { x: number; y: number } | null
  children: ReactNode
  /** Accessible label for the popover region. */
  label: string
  width?: number
}

const GAP = 6
const MARGIN = 8

/**
 * A small inline popover rendered in a portal so scroll containers never clip
 * it. It sits below its anchor (above if there is no room), scales in from
 * the anchor side, and closes on Escape or a click outside. Focus returns to
 * the anchor element when it closes.
 */
export function Popover({ open, onClose, anchor, children, label, width = 260 }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const rect =
        anchor instanceof HTMLElement
          ? anchor.getBoundingClientRect()
          : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y }
      const h = panel.current?.offsetHeight ?? 120
      const below = rect.bottom + GAP + h <= window.innerHeight - MARGIN
      const top = below ? rect.bottom + GAP : Math.max(MARGIN, rect.top - GAP - h)
      const left = Math.min(Math.max(MARGIN, rect.left), window.innerWidth - width - MARGIN)
      setPos({ top, left, origin: `${Math.round(rect.left - left)}px ${below ? 'top' : 'bottom'}` })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, width])

  useEffect(() => {
    if (!open) return
    const returnTo = anchor instanceof HTMLElement ? anchor : null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || returnTo?.contains(t)) return
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
      if (returnTo && document.activeElement === document.body) returnTo.focus()
    }
  }, [open, anchor, onClose])

  if (!open || !anchor) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className="pop-enter fixed z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width,
        transformOrigin: pos?.origin ?? 'left top',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
