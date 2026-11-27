import { useTest } from '../../store/test'
import { Timeline, type TimelineStep } from '../Timeline'
import { useTestView } from './testData'

/** Bottom timeline in Test mode: START, then one pill per symbol with the DFA state reached, then the verdict. */
export function TestTimeline() {
  const view = useTestView()
  const jump = useTest((s) => s.jump)
  if (!view || view.run.plan.length === 0) {
    const hint = !view
      ? 'Type a string over Σ on the right to see the run, symbol by symbol.'
      : 'The run is shown as text on the right (no step timeline for this machine or input size).'
    return <Timeline steps={[]} current={-1} hint={hint} />
  }
  const { trace } = view.run
  const steps: TimelineStep[] = [
    { kind: 'start', label: 'START', sublabel: trace.dfa.path[0] },
    ...trace.steps.map((s): TimelineStep => ({ kind: 'step', label: s.symbol, sublabel: `→ ${s.dfaTo ?? '—'}` })),
  ]
  return (
    <Timeline
      label="Run steps"
      steps={steps}
      current={view.step}
      onSelect={jump}
      hint=""
      result={view.atEnd ? (trace.nfaAccepted ? 'accepted' : 'rejected') : undefined}
    />
  )
}
