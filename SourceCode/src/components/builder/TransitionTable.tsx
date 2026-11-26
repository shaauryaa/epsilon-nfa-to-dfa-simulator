import { useState, type KeyboardEvent } from 'react'
import { EPSILON } from '../../core'
import { addState, addSymbol, formatTargets, parseTargets, setTargets, toggleTarget } from '../../model/edits'
import { useApp } from '../../store/automaton'
import { PlusIcon, TableIcon } from '../ui/Icons'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import { Section, fieldClass } from './Section'

/** Popover body: every state as a toggle chip, a typed alternative and Clear. */
function TargetPicker({ state, symbol, label }: { state: string; symbol: string; label: string }) {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  const targets = nfa.transitions[state]?.[symbol] ?? []
  const [draft, setDraft] = useState<string | null>(null)
  const chosen = new Set(targets)
  const unknown = targets.filter((t) => !nfa.states.includes(t))
  const eps = symbol === EPSILON

  const toggle = (to: string) => commit(toggleTarget(useApp.getState().nfa, state, symbol, to), 'table')
  const saveTyped = () => {
    if (draft === null) return
    const next = parseTargets(draft)
    setDraft(null)
    if (next.join(',') !== targets.join(',')) commit(setTargets(useApp.getState().nfa, state, symbol, next), 'table')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTyped()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-xs text-slate-600">
        {label} = <span className="font-semibold text-slate-900">{formatTargets(targets)}</span>
      </p>
      <div role="group" aria-label="Target states" className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
        {[...new Set(nfa.states)].map((s, i) => {
          const on = chosen.has(s)
          return (
            <button
              key={s}
              type="button"
              autoFocus={i === 0}
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={`press h-7 max-w-full min-w-8 truncate rounded-md border px-2 font-mono text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                on
                  ? eps
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {s}
            </button>
          )
        })}
        {unknown.map((s) => (
          <button
            key={`x-${s}`}
            type="button"
            aria-pressed
            title={`“${s}” is not a state. Click to remove it.`}
            onClick={() => toggle(s)}
            className="press h-7 rounded-md border border-red-300 bg-red-50 px-2 font-mono text-xs font-semibold text-red-700 line-through"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <input
          aria-label={`Targets for ${label}`}
          value={draft ?? targets.join(', ')}
          placeholder="or type: 1, 7"
          onFocus={() => setDraft(targets.join(', '))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveTyped}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          className={`${fieldClass} min-w-0 flex-1 border-slate-300 font-mono text-xs`}
        />
        <button
          type="button"
          disabled={targets.length === 0}
          onClick={() => commit(setTargets(useApp.getState().nfa, state, symbol, []), 'table')}
          className="press h-8 shrink-0 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

function Cell({ row, state, symbol }: { row: number; state: string; symbol: string }) {
  const targets = useApp((s) => s.nfa.transitions[state]?.[symbol])
  const known = useApp((s) => s.nfa.states)
  const setHover = useApp((s) => s.setHoverCell)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const label = `δ(${state}, ${symbol})`
  const unknown = (targets ?? []).filter((t) => !known.includes(t))
  const invalid = unknown.length > 0
  const value = formatTargets(targets)
  const eps = symbol === EPSILON

  const tip = anchor ? null : (
    <span className="font-mono">
      {label} = {value}
      {invalid && (
        <span className="mt-0.5 block font-sans">
          {unknown.map((u) => `“${u}”`).join(', ')} {unknown.length === 1 ? 'is not a state' : 'are not states'}
        </span>
      )}
    </span>
  )
  const enter = () => setHover({ state, symbol })
  const leave = () => setHover(null)

  return (
    <>
      <Tooltip content={tip} tone={invalid ? 'error' : 'neutral'}>
        <button
          type="button"
          data-focus={`cell:${row}:${symbol}`}
          aria-label={label}
          aria-invalid={invalid}
          aria-haspopup="dialog"
          aria-expanded={!!anchor}
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onFocus={enter}
          onBlur={leave}
          className={`h-7 w-full min-w-12 rounded-md border px-1.5 text-center font-mono text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
            invalid
              ? 'border-red-400 bg-red-50 text-red-700'
              : anchor
                ? 'border-blue-400 bg-blue-50 text-blue-800'
                : value === '∅'
                  ? 'border-transparent text-slate-300 hover:border-slate-200 hover:bg-white hover:text-slate-500'
                  : `border-transparent hover:border-slate-200 hover:bg-white ${eps ? 'text-violet-700' : 'text-slate-800'}`
          }`}
        >
          {value}
        </button>
      </Tooltip>
      <Popover open={!!anchor} anchor={anchor} onClose={() => setAnchor(null)} label={`Edit ${label}`} width={268}>
        <TargetPicker state={state} symbol={symbol} label={label} />
      </Popover>
    </>
  )
}

/**
 * Transition table in textbook notation: rows are states (→ start, * final),
 * columns are symbols then ε, and each cell is the set δ(state, symbol).
 * Hovering a cell highlights it on the canvas; clicking it picks targets.
 */
export function TransitionTable() {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  const finals = new Set(nfa.finals)
  const symbols = [...nfa.alphabet, EPSILON]
  const head = 'sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-1.5 py-1.5 text-center font-semibold'

  return (
    <Section title="Transition table" icon={<TableIcon size={13} />}>
      <p className="text-xs text-slate-600">
        <span className="font-mono text-slate-800">δ(state, symbol)</span> = set of next states
      </p>
      <p className="mt-0.5 mb-2 text-xs text-slate-500">
        <span className="font-mono text-slate-700">→</span> start · <span className="font-mono text-slate-700">*</span> final ·{' '}
        <span className="font-mono text-slate-700">∅</span> no transition
      </p>
      {nfa.states.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
          No states yet. Add one above or with the + below.
        </p>
      ) : null}
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-separate border-spacing-0 font-mono text-xs">
            <thead>
              <tr>
                <th scope="col" className={`${head} left-0 z-20 pl-2.5 text-left text-slate-500`}>
                  δ
                </th>
                {symbols.map((sym, i) => (
                  <th
                    key={`${sym}-${i}`}
                    scope="col"
                    className={`${head} ${sym === EPSILON ? 'text-violet-600' : 'text-slate-700'}`}
                    title={sym === EPSILON ? 'ε-moves: change state without reading a symbol' : undefined}
                  >
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nfa.states.map((state, row) => {
                const start = nfa.start === state
                const final = finals.has(state)
                return (
                  <tr key={`${state}-${row}`} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-[5] border-b border-slate-100 bg-white py-0.5 pr-1 pl-2.5 text-left font-semibold whitespace-nowrap group-hover:bg-slate-50"
                    >
                      <span
                        aria-label={`${start ? 'start, ' : ''}${final ? 'final, ' : ''}${state}`}
                        title={state}
                        className="block max-w-24 truncate"
                      >
                        <span aria-hidden="true" className="text-blue-600">
                          {start ? '→' : ''}
                        </span>
                        <span aria-hidden="true" className="text-emerald-600">
                          {final ? '*' : ''}
                        </span>
                        <span aria-hidden="true" className={final ? 'text-emerald-700' : start ? 'text-blue-700' : 'text-slate-800'}>
                          {state === '' ? '(blank)' : state}
                        </span>
                      </span>
                    </th>
                    {symbols.map((sym, i) => (
                      <td key={`${sym}-${i}`} className="border-b border-slate-100 px-0.5 py-0.5 group-hover:bg-slate-50">
                        <Cell row={row} state={state} symbol={sym} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          aria-label="Add symbol column"
          title="Add a symbol (new column)"
          onClick={() => commit(addSymbol(useApp.getState().nfa).nfa, 'table')}
          className="press grid w-6 shrink-0 place-items-center self-stretch rounded-md border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <PlusIcon size={13} />
        </button>
      </div>
      <button
        type="button"
        aria-label="Add state row"
        title="Add a state (new row)"
        onClick={() => commit(addState(useApp.getState().nfa).nfa, 'table')}
        className="press mt-1 grid h-6 w-[calc(100%-1.75rem)] place-items-center rounded-md border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <PlusIcon size={13} />
      </button>
    </Section>
  )
}
