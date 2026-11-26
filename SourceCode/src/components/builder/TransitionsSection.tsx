import { useRef, useState, type FormEvent } from 'react'
import { EPSILON } from '../../core'
import { addSymbol, addTransition, parseSymbols, removeTransition } from '../../model/edits'
import { listTransitions } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { ArrowsIcon, ChevronIcon, PlusIcon, TrashIcon } from '../ui/Icons'
import { Section, fieldClass } from './Section'

function StateSelect({ label, value, onChange, states }: { label: string; value: string; onChange: (v: string) => void; states: string[] }) {
  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      <select
        aria-label={`${label} state`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} w-full appearance-none border-slate-300 pr-6 pl-2 font-mono text-xs ${value === '' ? 'text-slate-400' : ''}`}
      >
        <option value="">{label}</option>
        {states.map((s) => (
          <option key={s} value={s} className="text-slate-900">
            {s}
          </option>
        ))}
      </select>
      <ChevronIcon size={13} className="pointer-events-none absolute right-1.5 text-slate-400" />
    </span>
  )
}

/** Symbol shown in a transition row: ε in violet, other symbols in blue. */
function Sym({ s }: { s: string }) {
  return <span className={`font-semibold ${s === EPSILON ? 'text-violet-600' : 'text-blue-700'}`}>{s}</span>
}

/**
 * "Add transition": a from / symbol / to form (with an ε button) and the list
 * of every transition as `q0 —a→ q1` rows with delete.
 */
export function TransitionsSection() {
  const nfa = useApp((s) => s.nfa)
  const commit = useApp((s) => s.commit)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [symbols, setSymbols] = useState('')
  const [error, setError] = useState<string | null>(null)
  const symbolInput = useRef<HTMLInputElement>(null)
  const states = [...new Set(nfa.states)]
  const declared = new Set(nfa.states)
  const list = listTransitions(nfa)

  // Forget a chosen state once it is renamed or deleted.
  const safeFrom = declared.has(from) ? from : ''
  const safeTo = declared.has(to) ? to : ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const syms = parseSymbols(symbols, nfa.alphabet)
    if (!safeFrom) return setError('Choose a “from” state.')
    if (syms.length === 0) return setError('Enter a symbol, or ε for an ε-move.')
    if (!safeTo) return setError('Choose a “to” state.')
    let next = useApp.getState().nfa
    for (const sym of syms) {
      if (sym !== EPSILON && !next.alphabet.includes(sym)) next = addSymbol(next, sym).nfa
      next = addTransition(next, safeFrom, sym, safeTo)
    }
    setError(null)
    setSymbols('')
    commit(next, 'table')
  }

  const insertEpsilon = () => {
    setSymbols((v) => (v.trim() === '' ? EPSILON : `${v.replace(/[\s,]+$/, '')}, ${EPSILON}`))
    symbolInput.current?.focus()
  }

  return (
    <Section title="Add transition" icon={<ArrowsIcon size={13} />}>
      <form onSubmit={submit} noValidate>
        <div className="flex gap-1.5">
          <StateSelect label="From" value={safeFrom} onChange={setFrom} states={states} />
          <input
            ref={symbolInput}
            value={symbols}
            onChange={(e) => {
              setSymbols(e.target.value)
              setError(null)
            }}
            aria-label="Symbol"
            placeholder="a / ε"
            title="One symbol, several as a,b, or ε (eps) for an ε-move"
            spellCheck={false}
            autoComplete="off"
            className={`${fieldClass} w-16 min-w-0 border-slate-300 px-1.5 text-center font-mono`}
          />
          <button
            type="button"
            onClick={insertEpsilon}
            aria-label="Insert ε"
            title="Insert ε (empty move)"
            className="press h-8 shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 font-mono text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-500"
          >
            ε
          </button>
          <StateSelect label="To" value={safeTo} onChange={setTo} states={states} />
        </div>
        <button
          type="submit"
          className="press mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <PlusIcon size={14} /> Add transition
        </button>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-slate-500">
            Tip: enter <span className="font-mono text-slate-700">a,b</span> for several symbols, or{' '}
            <span className="font-mono text-violet-700">ε</span> / <span className="font-mono text-violet-700">eps</span> for an
            ε-move. New symbols join Σ.
          </p>
        )}
      </form>

      {list.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-xs text-slate-500 tabular-nums">
            {list.length} {list.length === 1 ? 'transition' : 'transitions'}
          </p>
          <ul aria-label="Transitions" className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-0.5">
            {list.map((t) => {
              const bad = !declared.has(t.to) || !declared.has(t.from)
              return (
                <li
                  key={`${t.from}\u0000${t.symbol}\u0000${t.to}`}
                  className={`flex items-center justify-between rounded-md border px-2.5 py-1 text-xs ${
                    bad ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 font-mono break-all text-slate-700">
                    <span className="font-semibold text-slate-900">{t.from}</span>
                    <span className="mx-1.5 text-slate-400">
                      —<Sym s={t.symbol} />→
                    </span>
                    <span className={`font-semibold ${declared.has(t.to) ? 'text-slate-900' : 'text-red-700'}`}>{t.to}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete transition ${t.from} ${t.symbol} ${t.to}`}
                    title="Delete transition"
                    onClick={() => commit(removeTransition(useApp.getState().nfa, t.from, t.symbol, t.to), 'table')}
                    className="press ml-2 shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    <TrashIcon size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Section>
  )
}
