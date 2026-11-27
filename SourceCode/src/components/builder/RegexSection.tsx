import { useState, type FormEvent } from 'react'
import { regexToENFA, RegexSyntaxError } from '../../core'
import { useApp } from '../../store/automaton'
import { toast } from '../../store/toasts'
import { CodeIcon } from '../ui/Icons'
import { Section, fieldClass } from './Section'

const undoAction = { label: 'Undo', run: () => useApp.getState().undo() }

/**
 * "From regex": type a regular expression and build its Thompson ε-NFA.
 * Building replaces the machine (with an Undo toast) and re-fits the graph.
 */
export function RegexSection() {
  const commit = useApp((s) => s.commit)
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    let nfa
    try {
      nfa = regexToENFA(source)
    } catch (err) {
      if (err instanceof RegexSyntaxError) return setError(`Position ${err.position}: ${err.message}`)
      throw err
    }
    if (nfa.alphabet.length === 0) return setError('Use at least one symbol, so the alphabet is not empty.')
    setError(null)
    commit(nfa, 'import')
    toast({ message: `Built the Thompson ε-NFA for ${source.trim()} (${nfa.states.length} states)`, tone: 'success', action: undoAction })
  }

  return (
    <Section title="From regex" icon={<CodeIcon size={13} />}>
      <form onSubmit={submit} noValidate className="flex gap-1.5">
        <input
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            setError(null)
          }}
          aria-label="Regular expression"
          aria-invalid={error ? true : undefined}
          aria-describedby="regex-hint"
          placeholder="(a|b)*abb"
          spellCheck={false}
          autoComplete="off"
          className={`${fieldClass} min-w-0 flex-1 font-mono ${error ? 'border-red-400' : 'border-slate-300'}`}
        />
        <button
          type="submit"
          className="press h-8 shrink-0 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Build
        </button>
      </form>
      {error ? (
        <p id="regex-hint" role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : (
        <p id="regex-hint" className="mt-1.5 text-xs text-slate-500">
          a–z 0–9, <span className="font-mono text-slate-700">| +</span> union, <span className="font-mono text-slate-700">* ?</span>,{' '}
          <span className="font-mono text-slate-700">( )</span>, <span className="font-mono text-violet-700">ε</span>/
          <span className="font-mono text-violet-700">eps</span>
        </p>
      )}
    </Section>
  )
}
