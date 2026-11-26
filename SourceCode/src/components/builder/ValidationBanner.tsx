import { focusTargetFor } from '../../model/issues'
import { listTransitions } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { AlertIcon, CheckIcon, WarnIcon } from '../ui/Icons'

/**
 * One-line machine status at the top of the builder: red with the first
 * error, amber with the first warning, or green when valid. Clicking a
 * problem jumps to it.
 */
export function ValidationBanner() {
  const { errors, warnings } = useApp((s) => s.validation)
  const parseError = useApp((s) => s.parseError)
  const nfa = useApp((s) => s.nfa)
  const requestFocus = useApp((s) => s.requestFocus)

  const jump = (issue: (typeof errors)[number]) => {
    const { nfa: m, textDraft } = useApp.getState()
    requestFocus(focusTargetFor(issue, m, textDraft))
  }

  let body
  if (parseError || errors.length > 0) {
    const n = errors.length + (parseError ? 1 : 0)
    const first = parseError ? `Text format, line ${parseError.line}: ${parseError.message}.` : errors[0].message
    body = (
      <button
        type="button"
        onClick={() => (parseError ? requestFocus({ kind: 'text', line: parseError.line }) : jump(errors[0]))}
        className="flex w-full items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 p-2.5 text-left text-xs text-red-800 hover:bg-red-100/70 focus-visible:outline-2 focus-visible:outline-red-500"
      >
        <AlertIcon size={13} className="mt-px shrink-0 text-red-600" />
        <span className="min-w-0">
          <strong className="font-semibold">
            {n} {n === 1 ? 'error' : 'errors'}
          </strong>{' '}
          · {first}
        </span>
      </button>
    )
  } else if (warnings.length > 0) {
    body = (
      <button
        type="button"
        onClick={() => jump(warnings[0])}
        className="flex w-full items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-left text-xs text-amber-900 hover:bg-amber-100/70 focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        <WarnIcon size={13} className="mt-px shrink-0 text-amber-600" />
        <span className="min-w-0">
          <strong className="font-semibold">Valid ε-NFA</strong> ·{' '}
          {warnings.length === 1 ? warnings[0].message : `${warnings.length} warnings. ${warnings[0].message}`}
        </span>
      </button>
    )
  } else {
    const t = listTransitions(nfa).length
    body = (
      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckIcon size={13} className="text-emerald-600" />
        <span>
          Valid ε-NFA ({nfa.states.length} {nfa.states.length === 1 ? 'state' : 'states'}, {t} {t === 1 ? 'transition' : 'transitions'})
        </span>
      </p>
    )
  }

  return (
    <div data-testid="validation-banner" className="border-b border-slate-200 px-4 py-2.5">
      {body}
    </div>
  )
}
