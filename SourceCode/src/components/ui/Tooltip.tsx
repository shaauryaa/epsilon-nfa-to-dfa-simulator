import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { cloneElement } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  /** Tooltip text; when `null` the child renders without a tooltip. */
  content: ReactNode | null
  tone?: 'neutral' | 'error'
  children: ReactElement<Record<string, unknown>>
}

/**
 * Shows a short text above its child on hover or keyboard focus. Rendered in
 * a portal so table scroll areas do not clip it. The child gets
 * `aria-describedby` while the tooltip is visible.
 */
export function Tooltip({ content, tone = 'neutral', children }: TooltipProps) {
  const id = useId()
  const [rect, setRect] = useState<DOMRect | null>(null)
  if (content === null) return children

  const show = (e: { currentTarget: EventTarget }) => setRect((e.currentTarget as HTMLElement).getBoundingClientRect())
  const hide = () => setRect(null)
  const childProps = children.props as Record<string, ((e: unknown) => void) | undefined>
  const chain = (name: string, fn: (e: { currentTarget: EventTarget }) => void) => (e: { currentTarget: EventTarget }) => {
    childProps[name]?.(e)
    fn(e)
  }

  return (
    <>
      {cloneElement(children, {
        'aria-describedby': rect ? id : undefined,
        onMouseEnter: chain('onMouseEnter', show),
        onMouseLeave: chain('onMouseLeave', hide),
        onFocus: chain('onFocus', show),
        onBlur: chain('onBlur', hide),
      })}
      {rect &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className={`pop-enter pointer-events-none fixed z-50 max-w-64 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-xs font-medium shadow-md ${
              tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
            }`}
            style={{ left: rect.left + rect.width / 2, top: rect.top - 6, transformOrigin: 'center bottom' }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
