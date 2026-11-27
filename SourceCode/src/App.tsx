import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { BottomPanel } from './components/BottomPanel'
import { LeftSidebar } from './components/builder/LeftSidebar'
import { GraphView } from './components/canvas/GraphView'
import { ConvertCanvas } from './components/convert/ConvertCanvas'
import { TestCanvas } from './components/test/TestCanvas'
import { AboutDialog, DocsDialog } from './components/InfoDialogs'
import { RightSidebar } from './components/inspector/RightSidebar'
import { Navbar } from './components/Navbar'
import { SidebarIcon } from './components/ui/Icons'
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

/** The collapsed builder: a slim rail with a button to open it again. */
function BuilderRail({ onOpen }: { onOpen: () => void }) {
  return (
    <aside aria-label="Builder (collapsed)" className="flex w-[var(--left-w)] shrink-0 flex-col items-center border-r border-slate-200 bg-white py-3">
      <button
        type="button"
        onClick={onOpen}
        title="Show the builder"
        aria-label="Show the builder"
        className="press rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <SidebarIcon size={16} />
      </button>
      <span className="mt-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase [writing-mode:vertical-rl]">Builder</span>
    </aside>
  )
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
  const [builderChoice, setBuilderChoice] = useState<boolean | null>(null)
  useHistoryShortcuts()
  const convert = tab === 'convert'
  const split = convert || tab === 'test'
  // In Convert and Test the builder starts collapsed at every width, so both canvases get the room; the rail reopens it.
  const builderOpen = !split || (builderChoice ?? false)
  const geometry = {
    '--left-w': builderOpen ? '360px' : '44px',
    '--right-w': split ? '384px' : '320px',
  } as CSSProperties

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900" style={geometry}>
      <Navbar onDocs={openDocs} onAbout={openAbout} />
      <main id="workspace" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex min-h-0 flex-1 overflow-hidden">
        <h2 className="sr-only">{TABS.find((t) => t.id === tab)?.label}</h2>
        {builderOpen ? <LeftSidebar onCollapse={split ? () => setBuilderChoice(false) : undefined} /> : <BuilderRail onOpen={() => setBuilderChoice(true)} />}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <section aria-label={split ? 'ε-NFA and DFA diagrams' : 'State diagram'} className="min-h-0 flex-1">
            {convert ? (
              <ConvertCanvas />
            ) : tab === 'test' ? (
              <TestCanvas />
            ) : (
              <ReactFlowProvider>
                <GraphView />
              </ReactFlowProvider>
            )}
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
