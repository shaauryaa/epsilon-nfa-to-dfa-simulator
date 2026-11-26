import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { BottomPanel } from './components/BottomPanel'
import { LeftSidebar } from './components/builder/LeftSidebar'
import { GraphView } from './components/canvas/GraphView'
import { AboutDialog, DocsDialog } from './components/InfoDialogs'
import { RightSidebar } from './components/inspector/RightSidebar'
import { Navbar } from './components/Navbar'
import { Toaster } from './components/ui/Toaster'
import { TABS, useApp } from './store/automaton'
import { toast } from './store/toasts'

/**
 * Ctrl/Cmd+Z undoes and Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redoes the last
 * machine edit when focus is not in a text field.
 */
function useHistoryShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const redo = key === 'y' || (key === 'z' && e.shiftKey)
      const undo = key === 'z' && !e.shiftKey
      if (!undo && !redo) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      const { undo: doUndo, redo: doRedo } = useApp.getState()
      if (undo ? doUndo() : doRedo()) toast({ message: undo ? 'Undone' : 'Redone', tone: 'info' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * The workspace: navbar on top; below it the builder (left), the canvas with
 * the timeline under it (centre) and the inspector (right). The page itself
 * never scrolls; each sidebar scrolls on its own.
 */
function App() {
  const tab = useApp((s) => s.activeTab)
  const [dialog, setDialog] = useState<'docs' | 'about' | null>(null)
  const openDocs = useCallback(() => setDialog('docs'), [])
  const openAbout = useCallback(() => setDialog('about'), [])
  const close = useCallback(() => setDialog(null), [])
  useHistoryShortcuts()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <Navbar onDocs={openDocs} onAbout={openAbout} />
      <main id="workspace" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex min-h-0 flex-1 overflow-hidden">
        <h2 className="sr-only">{TABS.find((t) => t.id === tab)?.label}</h2>
        <LeftSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <section aria-label="State diagram" className="min-h-0 flex-1">
            <ReactFlowProvider>
              <GraphView />
            </ReactFlowProvider>
          </section>
          <BottomPanel />
        </div>
        <RightSidebar />
      </main>
      <DocsDialog open={dialog === 'docs'} onClose={close} />
      <AboutDialog open={dialog === 'about'} onClose={close} />
      <Toaster />
    </div>
  )
}

export default App
