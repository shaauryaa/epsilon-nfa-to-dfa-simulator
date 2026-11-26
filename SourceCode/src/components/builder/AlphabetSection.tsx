import { useState, type FormEvent } from 'react'
import { addSymbol, checkName, deleteSymbol, nextSymbolName, renameSymbol } from '../../model/edits'
import { useApp } from '../../store/automaton'
import { toast } from '../../store/toasts'
import { CloseIcon, PlusIcon, SigmaIcon } from '../ui/Icons'
import { Popover } from '../ui/Popover'
import { Tooltip } from '../ui/Tooltip'
import { NameEditor } from './NameEditor'
import { Section, fieldClass } from './Section'

const undoAction = { label: 'Undo', run: () => useApp.getState().undo() }

function SymbolChip({ symbol, invalid }: { symbol: string; invalid: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const alphabet = useApp((s) => s.nfa.alphabet)
  const commit = useApp((s) => s.commit)
  const close = () => setAnchor(null)
  const remove = () => {
    close()
    commit(deleteSymbol(useApp.getState().nfa, symbol), 'table')
    toast({ message: `Deleted symbol ${symbol}`, tone: 'info', action: undoAction })
  }

  return (
    <li
      className={`flex h-7 items-center rounded-md border font-mono text-xs font-semibold ${
        invalid ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-800'
      }`}
    >
      <button
        type="button"
        data-focus={`symbol:${symbol}`}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-invalid={invalid}
        title="Rename or delete this symbol"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="h-full max-w-28 truncate rounded-l-md pr-1 pl-2 hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {symbol === '' ? <span className="font-sans font-normal text-slate-400 italic">blank</span> : symbol}
      </button>
      <button
        type="button"
        aria-label={`Remove symbol ${symbol}`}
        title="Remove symbol and its transitions"
        onClick={remove}
        className="grid h-full place-items-center rounded-r-md px-1 text-slate-400 hover:bg-white hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <CloseIcon size={12} />
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
          onDelete={remove}
        />
      </Popover>
    </li>
  )
}

/** Alphabet Σ as chips (click to rename, × to remove), ε shown for reference, and an add form. */
export function AlphabetSection() {
  const alphabet = useApp((s) => s.nfa.alphabet)
  const errors = useApp((s) => s.validation.errors)
  const commit = useApp((s) => s.commit)
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const trimmed = name.trim()
  const error = trimmed === '' ? null : checkName(trimmed, alphabet, 'symbol')
  const bad = new Set(
    errors
      .filter((e) => e.code === 'DUPLICATE_SYMBOL' || e.code === 'EPSILON_IN_ALPHABET' || (e.code === 'INVALID_NAME' && e.symbol !== undefined))
      .map((e) => e.symbol),
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    commit(addSymbol(useApp.getState().nfa, trimmed || undefined).nfa, 'table')
    setName('')
    setTouched(false)
  }

  return (
    <Section title="Alphabet" icon={<SigmaIcon size={13} />} meta={`Σ = ${alphabet.length}`}>
      <ul aria-label="Alphabet symbols" className="flex flex-wrap gap-1.5">
        {alphabet.map((a, i) => (
          <SymbolChip key={`${a}-${i}`} symbol={a} invalid={bad.has(a)} />
        ))}
        <li>
          <Tooltip content="ε (empty move, not in Σ)">
            <span
              data-focus="eps"
              tabIndex={-1}
              aria-label="ε (empty move, not in Σ)"
              className="inline-flex h-7 cursor-help items-center rounded-md border border-dashed border-violet-300 bg-violet-50 px-2 font-mono text-xs font-semibold text-violet-700 outline-none"
            >
              ε
            </span>
          </Tooltip>
        </li>
      </ul>
      <form onSubmit={submit} className="mt-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setTouched(true)
            }}
            aria-label="New symbol"
            aria-invalid={touched && !!error}
            placeholder={`Symbol (auto: ${nextSymbolName(alphabet)})`}
            spellCheck={false}
            autoComplete="off"
            className={`${fieldClass} min-w-0 flex-1 font-mono ${touched && error ? 'border-red-400' : 'border-slate-300'}`}
          />
          <button
            type="submit"
            data-focus="add-symbol"
            aria-label="Add symbol"
            title="Add symbol"
            className="press grid h-8 w-9 shrink-0 place-items-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <PlusIcon size={15} />
          </button>
        </div>
        {touched && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </form>
    </Section>
  )
}
