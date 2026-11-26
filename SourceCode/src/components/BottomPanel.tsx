import { useApp, type Tab } from '../store/automaton'
import { Timeline } from './Timeline'

const HINTS: Record<Tab, string> = {
  define:
    'Build the ε-NFA on the left. On the canvas: double-click to add a state, drag from a state’s blue dot to connect, right-click a state to set start or final.',
  convert: 'The subset construction steps will play here.',
  test: 'Run a string in Test mode to see each step here.',
  minimize: 'Partition refinement rounds will play here.',
}

/** Strip under the canvas that holds the step timeline. Later modes feed it steps. */
export function BottomPanel() {
  const tab = useApp((s) => s.activeTab)
  return (
    <section aria-label="Timeline" className="shrink-0 border-t border-slate-200 bg-white">
      <Timeline steps={[]} current={-1} hint={HINTS[tab]} />
    </section>
  )
}
