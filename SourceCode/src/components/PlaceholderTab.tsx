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

/** Temporary right-sidebar content for modes that are not built yet; shows the derived result is ready. */
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
    <section className="px-4 py-4">
      <h2 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      {errors > 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="inline-flex items-start gap-1.5 text-xs text-red-800">
            <AlertIcon size={13} className="mt-px shrink-0 text-red-600" /> Fix the {errors === 1 ? 'error' : `${errors} errors`} in
            the builder first.
          </p>
          <Button variant="primary" size="sm" onClick={() => setTab('define')}>
            Go to Define
          </Button>
        </div>
      ) : (
        summary && (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 tabular-nums">{summary}</p>
        )
      )}
    </section>
  )
}
