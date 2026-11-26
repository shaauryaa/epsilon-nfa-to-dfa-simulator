import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { EPSILON } from '../../core'
import {
  deleteState,
  deleteSymbol,
  parseTargets,
  renameState,
  renameSymbol,
  setFinal,
  setStart,
  setTargets,
} from '../../model/edits'
import { focusKey } from '../../model/issues'
import { useApp } from '../../store/automaton'
import { toast } from '../../store/toasts'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import { NameEditor } from './NameEditor'

const undoAction = { label: 'Undo', run: () => useApp.getState().undo() }

/** Last focus request handled, so remounting the table does not replay an old one. */
let handledFocus = 0

function TargetCell({ row, state, symbol, label }: { row: number; state: string; symbol: string; label: string }) {
  const targets = useApp((s) => s.nfa.transitions[state]?.[symbol])
  const errors = useApp((s) => s.validation.errors)
  const commit = useApp((s) => s.commit)
  const value = (targets ?? []).join(', ')
  const [draft, setDraft] = useState<string | null>(null)

  const unknown = useMemo(
    () =>
      (targets ?? []).filter((t) =>
        errors.some((e) => e.code === 'UNKNOWN_TARGET_STATE' && e.state === t && e.symbol === symbol),
      ),
    [targets, errors, symbol],
  )
  // Stays marked while being edited, until a corrected value is committed.
  const invalid = unknown.length > 0

  const save = () => {
    if (draft === null) return
    const next = parseTargets(draft)
    setDraft(null)
    if (next.join(', ') !== value) commit(setTargets(useApp.getState().nfa, state, symbol, next), 'table')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    }
  }

  const tip = invalid
    ? `${unknown.map((u) => `“${u}”`).join(', ')} ${unknown.length === 1 ? 'is not a state' : 'are not states'}`
    : null

  return (
    <Tooltip content={tip} tone="error">
      <input
        data-focus={`cell:${row}:${symbol}`}
        aria-label={label}
        aria-invalid={invalid}
        value={draft ?? value}
        placeholder="—"
        spellCheck={false}
        autoComplete="off"
        onFocus={() => setDraft(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKey}
        className={`h-8 w-full min-w-16 rounded-md border bg-transparent px-2 text-sm tabular-nums outline-none placeholder:text-slate-300 focus:bg-white focus:ring-2 ${
          invalid
            ? 'border-red-400 bg-red-50/60 text-red-700 focus:ring-red-200'
            : 'border-transparent hover:border-slate-200 focus:border-accent-500 focus:ring-accent-100'
        }`}
      />
    </Tooltip>
  )
}

function StateHeader({ row, name, invalid }: { row: number; name: string; invalid: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const states = useApp((s) => s.nfa.states)
  const commit = useApp((s) => s.commit)
  const close = () => setAnchor(null)

  return (
    <>
      <button
        type="button"
        data-focus={`state:${row}`}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-invalid={invalid}
        title="Rename or delete this state"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`press inline-flex h-8 max-w-36 items-center truncate rounded-md border px-2 text-sm font-semibold tabular-nums hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-accent-500 ${
          invalid ? 'border-red-400 bg-red-50 text-red-700' : 'border-transparent text-slate-900'
        }`}
      >
        {name === '' ? <span className="text-slate-400 italic">blank</span> : name}
      </button>
      <Popover open={!!anchor} anchor={anchor} onClose={close} label={`Edit state ${name}`}>
        <NameEditor
          kind="state"
          name={name}
          taken={states.filter((_, i) => i !== row)}
          deleteNote="Removes its transitions too."
          onRename={(to) => {
            commit(renameState(useApp.getState().nfa, name, to), 'table', { rename: [name, to] })
            close()
          }}
          onDelete={() => {
            close()
            commit(deleteState(useApp.getState().nfa, name), 'table')
            toast({ message: `Deleted state ${name}`, tone: 'info', action: undoAction })
          }}
        />
      </Popover>
    </>
  )
}

function SymbolHeader({ symbol, invalid }: { symbol: string; invalid: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const alphabet = useApp((s) => s.nfa.alphabet)
  const commit = useApp((s) => s.commit)
  const close = () => setAnchor(null)

  return (
    <>
      <button
        type="button"
        data-focus={`symbol:${symbol}`}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-invalid={invalid}
        title="Rename or delete this symbol"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`press inline-flex h-7 max-w-32 items-center truncate rounded-md border px-2 text-sm font-semibold hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-accent-500 ${
          invalid ? 'border-red-400 bg-red-50 text-red-700' : 'border-transparent text-slate-800'
        }`}
      >
        {symbol}
      </button>
      <Popover open={!!anchor} anchor={anchor} onClose={close} label={`Edit symbol ${symbol}`}>
        <NameEditor
          kind="symbol"
          name={symbol}
          taken={alphabet.filter((a) => a !== symbol)}
          deleteNote="Removes its transitions too."
          onRename={(to) => {
            commit(renameSymbol(useApp.getState().nfa, symbol, to), 'table')
            close()
          }}
          onDelete={() => {
            close()
            commit(deleteSymbol(useApp.getState().nfa, symbol), 'table')
            toast({ message: `Deleted symbol ${symbol}`, tone: 'info', action: undoAction })
          }}
        />
      </Popover>
    </>
  )
}

/**
 * Transition table: one row per state, one column per symbol plus ε. Cells
 * take comma-separated target states and commit on Enter or blur.
 */
export function TableEditor() {
  const nfa = useApp((s) => s.nfa)
  const errors = useApp((s) => s.validation.errors)
  const focusRequest = useApp((s) => s.focusRequest)
  const commit = useApp((s) => s.commit)
  const root = useRef<HTMLDivElement>(null)

  const badStates = new Set(
    errors.filter((e) => (e.code === 'DUPLICATE_STATE' || e.code === 'INVALID_NAME') && e.symbol === undefined).map((e) => e.state),
  )
  const badSymbols = new Set(
    errors
      .filter((e) => e.code === 'DUPLICATE_SYMBOL' || e.code === 'EPSILON_IN_ALPHABET' || (e.code === 'INVALID_NAME' && e.symbol !== undefined))
      .map((e) => e.symbol),
  )
  const startMissing = errors.some((e) => e.code === 'NO_START' || e.code === 'START_NOT_A_STATE')
  const finals = new Set(nfa.finals)

  // Focus the element the validation panel asked for, with a short highlight.
  useEffect(() => {
    if (!focusRequest || focusRequest.target.kind === 'text' || focusRequest.nonce === handledFocus) return
    handledFocus = focusRequest.nonce
    const el =
      root.current?.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey(focusRequest.target))}"]`) ??
      document.querySelector<HTMLElement>('[data-focus="add-state"]')
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    el.classList.remove('focus-flash')
    void el.offsetWidth
    el.classList.add('focus-flash')
  }, [focusRequest])

  const headCell = 'sticky top-0 z-10 bg-slate-50 px-2 py-1.5 text-left text-xs font-medium text-slate-500'

  return (
    <div ref={root} className="h-full overflow-auto">
      {nfa.states.length === 0 ? (
        <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-500">
          No states yet. Use “Add state” to create the first one.
        </div>
      ) : (
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${headCell} left-0 z-20 pl-4`}>
                State
              </th>
              <th scope="col" className={`${headCell} w-14 text-center`}>
                Start
              </th>
              <th scope="col" className={`${headCell} w-14 text-center`}>
                Final
              </th>
              {nfa.alphabet.map((sym, i) => (
                <th key={`${sym}-${i}`} scope="col" className={headCell}>
                  <SymbolHeader symbol={sym} invalid={badSymbols.has(sym)} />
                </th>
              ))}
              <th scope="col" className={`${headCell} pr-4`}>
                <span
                  data-focus="eps"
                  tabIndex={-1}
                  title="ε-moves: change state without reading a symbol"
                  className="inline-flex h-7 items-center rounded-md px-2 text-sm font-semibold text-accent-700 outline-none"
                >
                  ε
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {nfa.states.map((state, row) => (
              <tr key={`${state}-${row}`} className="group">
                <th
                  scope="row"
                  className="sticky left-0 z-[5] border-b border-slate-100 bg-white py-1 pr-1 pl-3 text-left group-hover:bg-slate-50/80"
                >
                  <StateHeader row={row} name={state} invalid={badStates.has(state)} />
                </th>
                <td className="border-b border-slate-100 text-center group-hover:bg-slate-50/80">
                  <input
                    type="radio"
                    name="start-state"
                    data-focus={`start:${row}`}
                    aria-label={`Start state ${state}`}
                    checked={nfa.start === state}
                    onChange={() => commit(setStart(nfa, state), 'table')}
                    className={`size-4 cursor-pointer accent-accent-600 ${startMissing ? 'outline-2 outline-offset-2 outline-red-400' : ''}`}
                  />
                </td>
                <td className="border-b border-slate-100 text-center group-hover:bg-slate-50/80">
                  <input
                    type="checkbox"
                    data-focus={`final:${row}`}
                    aria-label={`Final state ${state}`}
                    checked={finals.has(state)}
                    onChange={(e) => commit(setFinal(nfa, state, e.target.checked), 'table')}
                    className="size-4 cursor-pointer rounded accent-accent-600"
                  />
                </td>
                {nfa.alphabet.map((sym, i) => (
                  <td key={`${sym}-${i}`} className="border-b border-slate-100 px-1 py-1 group-hover:bg-slate-50/80">
                    <TargetCell row={row} state={state} symbol={sym} label={`δ(${state}, ${sym})`} />
                  </td>
                ))}
                <td className="border-b border-slate-100 py-1 pr-3 pl-1 group-hover:bg-slate-50/80">
                  <TargetCell row={row} state={state} symbol={EPSILON} label={`δ(${state}, ε)`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
