import { Fragment } from 'react'
import { CheckIcon, CloseIcon } from './ui/Icons'

/** One pill in the timeline. */
export interface TimelineStep {
  /** Kind decides the pill colour: start and steps are blue, accept green, reject red. */
  kind: 'start' | 'step' | 'accept' | 'reject'
  /** Pill text, e.g. `START`, `'a'` or `ACCEPT`. */
  label: string
  /** Small mono text under the pill, e.g. `→ {1, 2}`. */
  sublabel?: string
}

interface TimelineProps {
  steps: readonly TimelineStep[]
  /** Index of the current step; steps up to it are drawn as reached. */
  current: number
  /** Called with a step's index when it is clicked. Without it the pills are not buttons. */
  onSelect?: (index: number) => void
  /** Shown instead of the pills when there are no steps. */
  hint: string
  /** Final verdict shown after the pills. */
  result?: 'accepted' | 'rejected'
  label?: string
}

const pill = (kind: TimelineStep['kind'], reached: boolean) => {
  if (!reached) return 'border-slate-200 bg-slate-50 text-slate-400'
  if (kind === 'accept') return 'border-emerald-400 bg-emerald-50 text-emerald-700'
  if (kind === 'reject') return 'border-red-400 bg-red-50 text-red-700'
  if (kind === 'start') return 'border-blue-400 bg-blue-50 text-blue-800'
  return 'border-blue-300 bg-blue-50 text-blue-800'
}

function Arrow({ reached }: { reached: boolean }) {
  return (
    <span aria-hidden="true" className={`mx-0.5 flex items-center ${reached ? 'text-blue-500' : 'text-slate-300'}`}>
      <span className={`h-0.5 w-4 transition-colors duration-150 ${reached ? 'bg-blue-500' : 'bg-slate-200'}`} />
      <svg width="6" height="8" viewBox="0 0 6 8" fill="currentColor">
        <path d="M0 0l6 4-6 4z" />
      </svg>
    </span>
  )
}

/**
 * A horizontal run of pills, START → 'a' → … → ACCEPT, fed entirely by
 * props. With no steps it shows a one-line hint instead.
 */
export function Timeline({ steps, current, onSelect, hint, result, label = 'Timeline' }: TimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex h-14 items-center px-6">
        <p className="truncate text-xs text-slate-500">{hint}</p>
      </div>
    )
  }
  return (
    <div className="max-h-28 overflow-x-auto">
      <ol aria-label={label} className="flex min-w-max items-center px-4 py-2.5">
        {steps.map((s, i) => {
          const reached = i <= current
          const content = (
            <>
              <span
                className={`min-w-[46px] rounded-md border px-2.5 py-1 text-center text-xs font-semibold transition-colors duration-150 ${pill(s.kind, reached)} ${
                  i === current ? 'ring-2 ring-blue-500/30' : ''
                }`}
              >
                {s.label}
              </span>
              {s.sublabel && <span className={`font-mono text-[11px] ${reached ? 'text-slate-600' : 'text-slate-400'}`}>{s.sublabel}</span>}
            </>
          )
          return (
            <Fragment key={i}>
              {i > 0 && <Arrow reached={reached} />}
              <li aria-current={i === current ? 'step' : undefined}>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    className="flex min-w-[58px] flex-col items-center gap-0.5 rounded-md focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    {content}
                  </button>
                ) : (
                  <span className="flex min-w-[58px] flex-col items-center gap-0.5">{content}</span>
                )}
              </li>
            </Fragment>
          )
        })}
        {result && (
          <li
            className={`ml-4 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              result === 'accepted' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {result === 'accepted' ? <CheckIcon size={13} /> : <CloseIcon size={13} />}
            {result === 'accepted' ? 'Accepted' : 'Rejected'}
          </li>
        )}
      </ol>
    </div>
  )
}
