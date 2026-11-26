import { useRef, type KeyboardEvent } from 'react'
import { FormatError, fromJSON, toJSON } from '../core'
import { presets } from '../presets'
import { blankENFA } from '../model/edits'
import { TABS, useApp } from '../store/automaton'
import { toast } from '../store/toasts'
import { Button } from './ui/Button'
import { ChevronIcon, DownloadIcon, FileIcon, HelpIcon, UploadIcon } from './ui/Icons'

const undoAction = { label: 'Undo', run: () => useApp.getState().undo() }

function Tabs() {
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
    <div role="tablist" aria-label="Simulator sections" className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
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
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`press h-8 rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500 ${
              selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function PresetSelect() {
  const presetId = useApp((s) => s.presetId)
  const loadPreset = useApp((s) => s.loadPreset)
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Example machine</span>
      <select
        value={presetId ?? ''}
        onChange={(e) => {
          const p = presets.find((x) => x.id === e.target.value)
          if (!p) return
          loadPreset(p.id)
          toast({ message: `Loaded “${p.name}”`, tone: 'info', action: undoAction })
        }}
        className="h-9 w-[19rem] appearance-none truncate rounded-lg border border-slate-200 bg-white pr-8 pl-3 text-sm text-slate-800 shadow-xs hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <option value="" disabled>
          Custom machine
        </option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronIcon className="pointer-events-none absolute right-2.5 text-slate-400" />
    </label>
  )
}

/** Top bar: title, section tabs and machine-level actions. */
export function Header({ onHelp }: { onHelp: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const commit = useApp((s) => s.commit)

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
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-6 px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-accent-600 text-[15px] font-semibold text-white">
            ε
          </span>
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">ε-NFA → DFA Simulator</h1>
        </div>
        <Tabs />
        <div className="ml-auto flex items-center gap-2">
          <PresetSelect />
          <Button onClick={() => fileInput.current?.click()} title="Import a machine from a JSON file">
            <UploadIcon /> Import
          </Button>
          <Button onClick={onExport} title="Download this machine as JSON">
            <DownloadIcon /> Export
          </Button>
          <Button onClick={onNew} title="Start from a blank machine">
            <FileIcon /> New
          </Button>
          <Button variant="ghost" onClick={onHelp} aria-label="Help" title="Help">
            <HelpIcon size={18} />
          </Button>
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
        </div>
      </div>
    </header>
  )
}
