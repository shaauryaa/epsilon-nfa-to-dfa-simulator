import { ReactFlowProvider } from 'reactflow'
import { addState, addSymbol } from '../../model/edits'
import { useApp, type EditorView } from '../../store/automaton'
import { Button } from '../ui/Button'
import { PlusIcon } from '../ui/Icons'
import { FormalDefinition } from './FormalDefinition'
import { GraphView } from './GraphView'
import { TableEditor } from './TableEditor'
import { TextEditor } from './TextEditor'
import { ValidationPanel } from './ValidationPanel'

const VIEWS: { id: EditorView; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'text', label: 'Text' },
]

function EditorCard() {
  const view = useApp((s) => s.editorView)
  const setView = useApp((s) => s.setEditorView)
  const commit = useApp((s) => s.commit)
  const counts = useApp((s) => `${s.nfa.states.length} states · ${s.nfa.alphabet.length} symbols`)

  return (
    <section aria-label="Editor" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
        <div role="radiogroup" aria-label="Editor view" className="flex rounded-lg bg-slate-100 p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              onClick={() => setView(v.id)}
              className={`press h-7 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-500 ${
                view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 tabular-nums">{counts}</span>
        {view === 'table' && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              data-focus="add-state"
              onClick={() => commit(addState(useApp.getState().nfa).nfa, 'table')}
            >
              <PlusIcon size={14} /> State
            </Button>
            <Button
              size="sm"
              data-focus="add-symbol"
              onClick={() => commit(addSymbol(useApp.getState().nfa).nfa, 'table')}
            >
              <PlusIcon size={14} /> Symbol
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">{view === 'table' ? <TableEditor /> : <TextEditor />}</div>
    </section>
  )
}

/** Define tab: table/text editor and graph side by side, validation and the formal definition below. */
export function DefineTab() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid h-[clamp(420px,calc(100vh-230px),700px)] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5">
        <EditorCard />
        <section aria-label="State diagram" className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <ReactFlowProvider>
            <GraphView />
          </ReactFlowProvider>
        </section>
      </div>
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-5">
        <ValidationPanel />
        <FormalDefinition />
      </div>
    </div>
  )
}
