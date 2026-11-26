import type { Issue } from '../../core'
import { focusTargetFor } from '../../model/issues'
import { useApp } from '../../store/automaton'
import { AlertIcon, CheckIcon, WarnIcon } from '../ui/Icons'

/** Status pill: green when the machine has no errors. */
export function ValidityBadge() {
  const errors = useApp((s) => s.validation.errors.length)
  const parseError = useApp((s) => s.parseError)
  if (errors === 0 && !parseError) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckIcon size={12} /> Valid ε-NFA
      </span>
    )
  }
  const n = errors + (parseError ? 1 : 0)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
      <AlertIcon size={12} /> {n} {n === 1 ? 'error' : 'errors'}
    </span>
  )
}

const row =
  'group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-blue-500'

function IssueRow({ issue, severity }: { issue: Issue; severity: 'error' | 'warning' }) {
  const requestFocus = useApp((s) => s.requestFocus)
  const onClick = () => {
    const { nfa, textDraft } = useApp.getState()
    requestFocus(focusTargetFor(issue, nfa, textDraft))
  }
  const error = severity === 'error'
  return (
    <li>
      <button type="button" onClick={onClick} className={`${row} ${error ? 'text-red-800 hover:bg-red-50' : 'text-amber-900 hover:bg-amber-50'}`}>
        {error ? (
          <AlertIcon size={13} className="mt-0.5 shrink-0 text-red-500" />
        ) : (
          <WarnIcon size={13} className="mt-0.5 shrink-0 text-amber-500" />
        )}
        <span className="min-w-0 flex-1">{issue.message}</span>
        <span className="shrink-0 text-[11px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Show
        </span>
      </button>
    </li>
  )
}

/** Every validation error (red) and warning (amber); each one jumps to the related control. */
export function ValidationPanel() {
  const { errors, warnings } = useApp((s) => s.validation)
  const parseError = useApp((s) => s.parseError)
  const requestFocus = useApp((s) => s.requestFocus)
  const empty = errors.length === 0 && warnings.length === 0 && !parseError

  return (
    <section aria-labelledby="validation-title" className="border-b border-slate-200">
      <div className="flex items-center gap-2 px-4 py-3">
        <h2 id="validation-title" className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
          Validation
        </h2>
        <span className="ml-auto">
          <ValidityBadge />
        </span>
      </div>
      {empty ? (
        <p className="px-4 pb-4 text-xs text-slate-500">No problems found. The machine is ready to convert.</p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 pb-3" aria-label="Problems">
          {parseError && (
            <li>
              <button
                type="button"
                onClick={() => requestFocus({ kind: 'text', line: parseError.line })}
                className={`${row} text-red-800 hover:bg-red-50`}
              >
                <AlertIcon size={13} className="mt-0.5 shrink-0 text-red-500" />
                <span>
                  Text format, line {parseError.line}: {parseError.message}.
                </span>
              </button>
            </li>
          )}
          {errors.map((e, i) => (
            <IssueRow key={`e${i}`} issue={e} severity="error" />
          ))}
          {warnings.map((w, i) => (
            <IssueRow key={`w${i}`} issue={w} severity="warning" />
          ))}
        </ul>
      )}
    </section>
  )
}
