import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { FormatError, fromJSON, toJSON } from '../core'
import { presets, type Preset } from '../presets'
import { blankENFA } from '../model/edits'
import { TABS, useApp } from '../store/automaton'
import { toast } from '../store/toasts'
import { DownloadMenu } from './DownloadMenu'
import {
  BookIcon,
  ChevronIcon,
  ChipIcon,
  DownloadIcon,
  FileIcon,
  InfoIcon,
  RedoIcon,
  UndoIcon,
  UploadIcon,
} from './ui/Icons'

const undoAction = { label: 'Undo', run: () => useApp.getState().undo() }
const QUICK = presets.filter((p) => p.shortName).slice(0, 3)

function loadExample(p: Preset) {
  useApp.getState().loadPreset(p.id)
  toast({ message: `Loaded “${p.name}”`, tone: 'info', action: undoAction })
}

/** The four modes as a segmented toggle; arrow keys move between them. */
function ModeToggle() {
  const active = useApp((s) => s.activeTab)
  const setActive = useApp((s) => s.setActiveTab)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + TABS.length) % TABS.length
    setActive(TABS[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label="Mode" className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
      {TABS.map((t, i) => {
        const selected = t.id === active
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls="workspace"
            tabIndex={selected ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`press rounded-md border px-3 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 ${
              selected
                ? 'border-slate-200/80 bg-white text-blue-700 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="press rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function NavButton({ icon, label, title, onClick, compact }: { icon: ReactNode; label: string; title?: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      className="press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      {icon}
      <span className={compact ? 'hidden min-[1600px]:inline' : undefined}>{label}</span>
    </button>
  )
}

function ExampleChips() {
  const presetId = useApp((s) => s.presetId)
  return (
    <div className="hidden items-center gap-1.5 xl:flex">
      {QUICK.map((p) => {
        const on = presetId === p.id
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            title={p.name}
            onClick={() => loadExample(p)}
            className={`press rounded-md border px-2.5 py-1 font-mono text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
              on
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            {p.shortName}
          </button>
        )
      })}
    </div>
  )
}

/** Every example in a menu. It always reads "Examples"; the loaded one is ticked. */
function ExampleSelect() {
  const presetId = useApp((s) => s.presetId)
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Examples</span>
      <select
        value=""
        onChange={(e) => {
          const p = presets.find((x) => x.id === e.target.value)
          if (p) loadExample(p)
        }}
        className="h-8 w-[7.25rem] appearance-none truncate rounded-md border border-slate-200 bg-white pr-7 pl-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
      >
        <option value="" disabled hidden>
          Examples
        </option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id === presetId ? '✓ ' : ''}
            {p.name}
          </option>
        ))}
      </select>
      <ChevronIcon size={14} className="pointer-events-none absolute right-2 text-slate-400" />
    </label>
  )
}

/** Top bar: logo, mode toggle, undo/redo, examples, file actions, docs and about. */
export function Navbar({ onDocs, onAbout }: { onDocs: () => void; onAbout: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const commit = useApp((s) => s.commit)
  const canUndo = useApp((s) => s.history.length > 0)
  const canRedo = useApp((s) => s.future.length > 0)

  const onImport = async (file: File) => {
    try {
      const nfa = fromJSON(await file.text())
      commit(nfa, 'import')
      toast({ message: `Imported ${file.name}`, tone: 'success', action: undoAction })
    } catch (e) {
      const reason = e instanceof FormatError ? e.message : 'The file could not be read.'
      toast({ message: `Could not import ${file.name}: ${reason}`, tone: 'error' })
    }
  }

  const onExport = () => {
    const { nfa, presetId } = useApp.getState()
    const name = `${presetId ?? 'enfa'}.json`
    const url = URL.createObjectURL(new Blob([toJSON(nfa) + '\n'], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    toast({ message: `Exported ${name}`, tone: 'success' })
  }

  const onNew = () => {
    commit(blankENFA(), 'new')
    toast({ message: 'Started a new blank machine', tone: 'info', action: undoAction })
  }

  return (
    <nav aria-label="Main" className="z-30 flex h-[var(--nav-h)] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5">
      <div className="mr-1 flex shrink-0 items-center gap-2.5">
        <div aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-slate-900 text-white">
          <ChipIcon size={16} />
        </div>
        <div>
          <h1 className="text-sm leading-tight font-semibold text-slate-900">ε-NFA → DFA Studio</h1>
          <p className="text-[11px] text-slate-500">CSET302 · Automata Theory</p>
        </div>
      </div>

      <div aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200" />
      <ModeToggle />

      <div className="flex items-center gap-0.5">
        <IconButton label="Undo (Ctrl+Z)" onClick={() => useApp.getState().undo()} disabled={!canUndo}>
          <UndoIcon size={15} />
        </IconButton>
        <IconButton label="Redo (Ctrl+Y)" onClick={() => useApp.getState().redo()} disabled={!canRedo}>
          <RedoIcon size={15} />
        </IconButton>
      </div>

      <ExampleChips />
      <ExampleSelect />

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <NavButton compact icon={<UploadIcon size={15} />} label="Import" title="Import a machine from a JSON file" onClick={() => fileInput.current?.click()} />
        <NavButton compact icon={<DownloadIcon size={15} />} label="Export" title="Download this machine as JSON" onClick={onExport} />
        <NavButton compact icon={<FileIcon size={15} />} label="New" title="Start from a blank machine" onClick={onNew} />
      </div>
      <div aria-hidden="true" className="h-6 w-px bg-slate-200" />
      <DownloadMenu />
      <div aria-hidden="true" className="h-6 w-px bg-slate-200" />
      <div className="flex items-center gap-0.5">
        <NavButton icon={<BookIcon size={15} />} label="Docs" onClick={onDocs} />
        <NavButton icon={<InfoIcon size={15} />} label="About" onClick={onAbout} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImport(f)
          e.target.value = ''
        }}
      />
    </nav>
  )
}
