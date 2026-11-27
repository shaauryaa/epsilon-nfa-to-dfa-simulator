import { useMinimize } from '../../store/minimize'
import { Timeline, type TimelineStep } from '../Timeline'
import { useMinimizeView } from './useMinimize'

/** Most round pills drawn; longer walkthroughs are stepped with the player. */
const MAX_PILLS = 80

/** Bottom timeline in Minimize mode: −1, completion, one pill per refinement round, then the result. */
export function MinimizeTimeline() {
  const state = useMinimizeView()
  const jump = useMinimize((s) => s.jump)
  if (!state) return <Timeline steps={[]} current={-1} hint="Fix the machine’s errors in Define to see the minimization rounds here." />
  const { steps } = state.min.view
  if (steps.length > MAX_PILLS) {
    return <Timeline steps={[]} current={-1} hint={`${steps.length} steps: use the player on the right or the rounds table to move between them.`} />
  }
  const pills: TimelineStep[] = steps.map((s) => ({
    kind: s.kind === 'unreachable' ? 'start' : s.kind === 'done' ? 'accept' : 'step',
    label: s.pill,
    sublabel: s.sublabel,
  }))
  return <Timeline label="Minimization rounds" steps={pills} current={state.index} onSelect={jump} hint="" />
}
