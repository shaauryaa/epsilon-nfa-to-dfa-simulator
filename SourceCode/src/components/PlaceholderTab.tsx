import { useApp, type Tab } from '../store/automaton'
import { Button } from './ui/Button'
import { AlertIcon } from './ui/Icons'

const COPY: Record<Exclude<Tab, 'define'>, { title: string; body: string }> = {
  convert: {
    title: 'Subset construction',
    body: 'The step-by-step ε-closure and subset construction walkthrough will appear here.',
  },
  test: {
    title: 'Test strings',
    body: 'Here you will run input strings through the ε-NFA and the DFA side by side.',
  },
  minimize: {
    title: 'Minimization',
    body: 'Partition refinement of the DFA, round by round, will appear here.',
  },
}

/** Temporary content for tabs that are not built yet; shows the derived result is ready. */
export function PlaceholderTab({ tab }: { tab: Exclude<Tab, 'define'> }) {
  const subset = useApp((s) => s.subset)
  const minimized = useApp((s) => s.minimized)
  const errors = useApp((s) => s.validation.errors.length)
  const setTab = useApp((s) => s.setActiveTab)
  const { title, body } = COPY[tab]

  const summary =
    tab === 'minimize'
      ? minimized && subset && `The ${subset.dfa.states.length}-state DFA minimizes to ${minimized.dfa.states.length} states.`
      : subset && `Subset construction finds ${subset.dfa.states.length} DFA states in ${subset.steps.length} recorded steps.`

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-xs">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        {errors > 0 ? (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="inline-flex items-center gap-1.5 text-sm text-red-700">
              <AlertIcon size={15} /> Fix the {errors === 1 ? 'error' : `${errors} errors`} in the Define tab first.
            </p>
            <Button variant="primary" onClick={() => setTab('define')}>
              Go to Define
            </Button>
          </div>
        ) : (
          summary && <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 tabular-nums">{summary}</p>
        )}
      </div>
    </div>
  )
}
