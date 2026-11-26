import { useApp, type Tab } from '../store/automaton'
import { useConvert } from '../store/convert'
import { useConvertTimeline } from './convert/useConversion'
import { Timeline } from './Timeline'

const HINTS: Record<Tab, string> = {
  define:
    'Build the ε-NFA on the left. On the canvas: double-click to add a state, drag from a state’s blue dot to connect, right-click a state to set start or final.',
  convert: 'Fix the machine’s errors in Define to see the subset construction steps here.',
  test: 'Run a string in Test mode to see each step here.',
  minimize: 'Partition refinement rounds will play here.',
}

function ConvertTimeline() {
  const timeline = useConvertTimeline()
  const jump = useConvert((s) => s.jump)
  return (
    <Timeline
      label="Subset construction steps"
      steps={timeline?.steps ?? []}
      current={timeline?.current ?? -1}
      onSelect={jump}
      hint={HINTS.convert}
    />
  )
}

/** Strip under the canvas that holds the step timeline. Each mode feeds it its own steps. */
export function BottomPanel() {
  const tab = useApp((s) => s.activeTab)
  return (
    <section aria-label="Timeline" className="shrink-0 border-t border-slate-200 bg-white">
      {tab === 'convert' ? <ConvertTimeline /> : <Timeline steps={[]} current={-1} hint={HINTS[tab]} />}
    </section>
  )
}
