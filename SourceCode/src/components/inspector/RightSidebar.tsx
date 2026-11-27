import { useApp } from '../../store/automaton'
import { Toaster } from '../ui/Toaster'
import { ConvertPanel } from '../convert/ConvertPanel'
import { MinimizePanel } from '../minimize/MinimizePanel'
import { TestPanel } from '../test/TestPanel'
import { FormalDefinition } from './FormalDefinition'
import { Stats } from './Stats'
import { ValidationPanel } from './ValidationPanel'

/**
 * Right column: the definition, stats and problems in Define; each other
 * mode's panel otherwise. Toasts appear over its bottom edge, away from the
 * graphs.
 */
export function RightSidebar() {
  const tab = useApp((s) => s.activeTab)
  return (
    <div className="relative flex w-[var(--right-w)] shrink-0">
      <aside aria-label="Inspector" className="flex w-full flex-col overflow-y-auto border-l border-slate-200 bg-white">
        {tab === 'define' ? (
          <>
            <FormalDefinition />
            <Stats />
            <ValidationPanel />
          </>
        ) : tab === 'convert' ? (
          <ConvertPanel />
        ) : tab === 'test' ? (
          <TestPanel />
        ) : (
          <MinimizePanel />
        )}
      </aside>
      <Toaster />
    </div>
  )
}
