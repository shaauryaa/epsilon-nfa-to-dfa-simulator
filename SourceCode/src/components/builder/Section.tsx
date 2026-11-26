import { useId, type ReactNode } from 'react'
import { ChevronIcon } from '../ui/Icons'

interface SectionProps {
  title: string
  icon?: ReactNode
  /** Small text after the title, such as a count. */
  meta?: ReactNode
  children: ReactNode
  /** When set, the heading toggles the body. */
  collapsible?: { open: boolean; onToggle: () => void }
}

/** A builder section: small uppercase heading over its body, separated by a rule. */
export function Section({ title, icon, meta, children, collapsible }: SectionProps) {
  const bodyId = useId()
  const open = collapsible ? collapsible.open : true
  const heading = (
    <>
      <span aria-hidden="true" className="text-slate-400">
        {icon}
      </span>
      <span className="text-xs font-semibold tracking-wider text-slate-700 uppercase">{title}</span>
      {meta !== undefined && <span className="text-xs text-slate-400 tabular-nums">{meta}</span>}
    </>
  )
  return (
    <section className="border-b border-slate-200">
      <h2>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={collapsible.onToggle}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
          >
            {heading}
            <ChevronIcon size={14} className={`ml-auto text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3">{heading}</div>
        )}
      </h2>
      {open && (
        <div id={bodyId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  )
}

/** Shared input look for the builder: white, slate border, blue focus ring. */
export const fieldClass =
  'h-8 rounded-md border bg-white px-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/12'
