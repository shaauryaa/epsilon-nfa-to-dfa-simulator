import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { addState, checkName, deleteState, nextStateName, renameState, setFinal, setStart } from '../../model/edits'
import { useApp } from '../../store/automaton'
import { toast } from '../../store/toasts'
import { ChevronIcon, CircleDotIcon, PlusIcon, TrashIcon } from '../ui/Icons'
import { Section, fieldClass } from './Section'

const undoAction = { label: 'Undo', run: () => useApp.getState().undo() }

function StartSelect() {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  const missing = useApp((s) => s.validation.errors.some((e) => e.code === 'NO_START' || e.code === 'START_NOT_A_STATE'))
  const undeclared = nfa.start !== '' && !nfa.states.includes(nfa.start)
  return (
    <label className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-medium text-slate-500">Start state</span>
      <span className="relative flex min-w-0 flex-1 items-center">
        <select
          data-focus="start"
          value={nfa.start}
          aria-invalid={missing}
          onChange={(e) => commit(setStart(nfa, e.target.value), 'table')}
          className={`${fieldClass} w-full appearance-none pr-7 font-mono ${missing ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300'}`}
        >
          {(nfa.start === '' || undeclared) && (
            <option value={nfa.start} disabled>
              {undeclared ? `${nfa.start} (not a state)` : 'Choose…'}
            </option>
          )}
          {[...new Set(nfa.states)].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ChevronIcon size={14} className="pointer-events-none absolute right-2 text-slate-400" />
      </span>
    </label>
  )
}

function FinalChips() {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  const noFinals = useApp((s) => s.validation.warnings.some((w) => w.code === 'NO_FINALS'))
  const finals = new Set(nfa.finals)
  const undeclared = nfa.finals.filter((f) => !nfa.states.includes(f))
  const states = [...new Set(nfa.states)]
  return (
    <div className="flex items-start gap-3">
      <span id="finals-label" className="w-20 shrink-0 pt-1 text-xs font-medium text-slate-500">
        Final states
      </span>
      <div role="group" aria-labelledby="finals-label" className="flex min-w-0 flex-1 flex-wrap gap-1">
        {states.length === 0 && <span className="pt-1 text-xs text-slate-400 italic">No states yet</span>}
        {states.map((s, i) => {
          const on = finals.has(s)
          return (
            <button
              key={s}
              type="button"
              data-focus={i === 0 ? 'final' : undefined}
              aria-pressed={on}
              title={on ? `${s} is final. Click to make it non-final.` : `Make ${s} final`}
              onClick={() => commit(setFinal(nfa, s, !on), 'table')}
              className={`press h-7 max-w-full min-w-8 truncate rounded-md border px-2 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                on
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : `bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 ${noFinals ? 'border-amber-300' : 'border-slate-200'}`
              }`}
            >
              {s}
            </button>
          )
        })}
        {undeclared.map((s) => (
          <button
            key={`x-${s}`}
            type="button"
            aria-pressed
            title={`${s} is not a state. Click to remove it from the final states.`}
            onClick={() => commit(setFinal(nfa, s, false), 'table')}
            className="press h-7 max-w-full truncate rounded-md border border-red-300 bg-red-50 px-2 font-mono text-xs font-semibold text-red-700 line-through"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function StateRow({ row, name }: { row: number; name: string }) {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  const invalid = useApp((s) =>
    s.validation.errors.some((e) => (e.code === 'DUPLICATE_STATE' || e.code === 'INVALID_NAME') && e.symbol === undefined && e.state === name),
  )
  const unreachable = useApp((s) => s.validation.warnings.some((w) => w.code === 'UNREACHABLE_STATE' && w.state === name))
  const [draft, setDraft] = useState<string | null>(null)
  const trimmed = draft?.trim() ?? ''
  const error = draft === null || trimmed === name ? null : checkName(trimmed, nfa.states.filter((_, i) => i !== row), 'state')

  const save = () => {
    if (draft === null) return
    if (error || trimmed === name) {
      setDraft(null)
      return
    }
    commit(renameState(useApp.getState().nfa, name, trimmed), 'table', { rename: [name, trimmed] })
    setDraft(null)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !error) save()
    if (e.key === 'Escape') {
      e.stopPropagation()
      setDraft(null)
    }
  }
  const remove = () => {
    commit(deleteState(useApp.getState().nfa, name), 'table')
    toast({ message: `Deleted state ${name}`, tone: 'info', action: undoAction })
  }

  return (
    <li>
      <div
        className={`flex h-9 items-center gap-1.5 rounded-md border px-2 ${
          invalid ? 'border-red-300 bg-red-50' : unreachable ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {draft !== null ? (
          <input
            autoFocus
            aria-label={`New name for state ${name}`}
            aria-invalid={!!error}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={save}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            className={`${fieldClass} h-7 min-w-0 flex-1 px-1.5 font-mono text-xs ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : 'border-slate-300'}`}
          />
        ) : (
          <button
            type="button"
            data-focus={`state:${row}`}
            title="Click to rename"
            aria-label={`Rename state ${name === '' ? '(blank)' : name}`}
            onClick={() => setDraft(name)}
            className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left font-mono text-xs font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-500 ${
              invalid ? 'text-red-700' : 'text-slate-800'
            }`}
          >
            {name === '' ? <span className="font-sans text-slate-400 italic">blank</span> : name}
          </button>
        )}
        {draft === null && nfa.start === name && (
          <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-px text-[10px] font-semibold tracking-wide text-blue-700">START</span>
        )}
        {draft === null && nfa.finals.includes(name) && (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10px] font-semibold tracking-wide text-emerald-700">FINAL</span>
        )}
        <button
          type="button"
          aria-label={`Delete state ${name}`}
          title="Delete state and its transitions"
          onMouseDown={(e) => e.preventDefault()}
          onClick={remove}
          className="press shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-white hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <TrashIcon size={13} />
        </button>
      </div>
      {error && <p className="mt-1 px-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

function AddState() {
  const commit = useApp((s) => s.commit)
  const states = useApp((s) => s.nfa.states)
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = name.trim()
  const error = trimmed === '' ? null : checkName(trimmed, states, 'state')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    commit(addState(useApp.getState().nfa, trimmed || undefined).nfa, 'table')
    setName('')
    setTouched(false)
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setTouched(true)
          }}
          aria-label="New state name"
          aria-invalid={touched && !!error}
          placeholder={`Name (auto: ${nextStateName(states)})`}
          spellCheck={false}
          autoComplete="off"
          className={`${fieldClass} min-w-0 flex-1 font-mono ${touched && error ? 'border-red-400' : 'border-slate-300'}`}
        />
        <button
          type="submit"
          data-focus="add-state"
          aria-label="Add state"
          title="Add state"
          className="press grid h-8 w-9 shrink-0 place-items-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <PlusIcon size={15} />
        </button>
      </div>
      {touched && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  )
}

/** States: the one start state, the final states, the state list and an add form. */
export function StatesSection() {
  const states = useApp((s) => s.nfa.states)
  return (
    <Section title="States" icon={<CircleDotIcon size={13} />} meta={states.length}>
      <div className="flex flex-col gap-2.5">
        <StartSelect />
        <FinalChips />
      </div>
      {states.length > 0 && (
        <ul aria-label="State list" className="mt-3 flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {states.map((s, i) => (
            <StateRow key={`${s}-${i}`} row={i} name={s} />
          ))}
        </ul>
      )}
      <AddState />
    </Section>
  )
}
