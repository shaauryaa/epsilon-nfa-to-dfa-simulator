import { useApp } from '../../store/automaton'
import { PlaceholderTab } from '../PlaceholderTab'
import { FormalDefinition } from './FormalDefinition'
import { Stats } from './Stats'
import { ValidationPanel } from './ValidationPanel'

/** Right column: the definition, stats and problems in Define; each other mode's panel otherwise. */
export function RightSidebar() {
  const tab = useApp((s) => s.activeTab)
  return (
    <aside aria-label="Inspector" className="flex w-[var(--right-w)] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      {tab === 'define' ? (
        <>
          <FormalDefinition />
          <Stats />
          <ValidationPanel />
        </>
      ) : (
        <PlaceholderTab tab={tab} />
      )}
    </aside>
  )
}
