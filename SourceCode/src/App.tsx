import { useCallback, useEffect, useState } from 'react'
import { DefineTab } from './components/define/DefineTab'
import { Header } from './components/Header'
import { HelpDialog } from './components/HelpDialog'
import { PlaceholderTab } from './components/PlaceholderTab'
import { Toaster } from './components/ui/Toaster'
import { TABS, useApp } from './store/automaton'
import { toast } from './store/toasts'

/** Ctrl/Cmd+Z undoes the last machine edit when focus is not in a text field. */
function useUndoShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      if (useApp.getState().undo()) toast({ message: 'Undone', tone: 'info' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function App() {
  const tab = useApp((s) => s.activeTab)
  const [helpOpen, setHelpOpen] = useState(false)
  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  useUndoShortcut()

  return (
    <div className="min-h-screen">
      <Header onHelp={openHelp} />
      <main
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mx-auto max-w-[1800px] px-6 pt-5 pb-10"
      >
        <h2 className="sr-only">{TABS.find((t) => t.id === tab)?.label}</h2>
        {tab === 'define' ? <DefineTab /> : <PlaceholderTab tab={tab} />}
      </main>
      <HelpDialog open={helpOpen} onClose={closeHelp} />
      <Toaster />
    </div>
  )
}

export default App
