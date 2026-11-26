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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckIcon size={13} /> Valid ε-NFA
      </span>
    )
  }
  const n = errors + (parseError ? 1 : 0)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
      <AlertIcon size={13} /> {n} {n === 1 ? 'error' : 'errors'}
    </span>
  )
}

function IssueRow({ issue, severity }: { issue: Issue; severity: 'error' | 'warning' }) {
  const requestFocus = useApp((s) => s.requestFocus)
  const onClick = () => {
    const { nfa, textDraft } = useApp.getState()
    requestFocus(focusTargetFor(issue, nfa, textDraft))
  }
  const error = severity === 'error'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-500 ${
          error ? 'text-red-800 hover:bg-red-50' : 'text-amber-900 hover:bg-amber-50'
        }`}
      >
        {error ? (
          <AlertIcon size={15} className="mt-0.5 shrink-0 text-red-500" />
        ) : (
          <WarnIcon size={15} className="mt-0.5 shrink-0 text-amber-500" />
        )}
        <span className="min-w-0 flex-1">{issue.message}</span>
        <span className="shrink-0 text-xs font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Show
        </span>
      </button>
    </li>
  )
}

/** Lists validation errors (red) and warnings (amber); each one jumps to the related cell. */
export function ValidationPanel() {
  const { errors, warnings } = useApp((s) => s.validation)
  const parseError = useApp((s) => s.parseError)
  const requestFocus = useApp((s) => s.requestFocus)
  const empty = errors.length === 0 && warnings.length === 0 && !parseError

  return (
    <section aria-labelledby="validation-title" className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 id="validation-title" className="text-sm font-semibold text-slate-900">
          Validation
        </h2>
        <ValidityBadge />
      </div>
      {empty ? (
        <p className="px-5 py-4 text-sm text-slate-500">No problems found. The machine is ready to convert.</p>
      ) : (
        <ul className="flex flex-col gap-0.5 p-2" aria-label="Problems">
          {parseError && (
            <li>
              <button
                type="button"
                onClick={() => requestFocus({ kind: 'text', line: parseError.line })}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-accent-500"
              >
                <AlertIcon size={15} className="mt-0.5 shrink-0 text-red-500" />
                <span>
                  Text editor, line {parseError.line}: {parseError.message}.
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
