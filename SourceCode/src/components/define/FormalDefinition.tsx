import { EPSILON, formatSet } from '../../core'
import { useApp } from '../../store/automaton'

const sym = 'font-semibold text-accent-700'

/** The machine written as the 5-tuple M = (Q, Σ, δ, q0, F) with its actual values. */
export function FormalDefinition() {
  const nfa = useApp((s) => s.nfa)
  const symbols = [...nfa.alphabet, EPSILON]
  const delta: { state: string; symbol: string; targets: string[] }[] = []
  for (const state of nfa.states) {
    for (const symbol of symbols) {
      const targets = nfa.transitions[state]?.[symbol]
      if (targets && targets.length > 0) delta.push({ state, symbol, targets })
    }
  }

  return (
    <section aria-labelledby="formal-title" className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 id="formal-title" className="text-sm font-semibold text-slate-900">
          Formal definition
        </h2>
        <span className="text-sm text-slate-600">
          M = (Q, Σ, δ, q<sub>0</sub>, F)
        </span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 py-4 text-sm tabular-nums">
        <dt className={sym}>Q</dt>
        <dd className="break-words text-slate-800">= {formatSet(nfa.states)}</dd>
        <dt className={sym}>Σ</dt>
        <dd className="break-words text-slate-800">= {formatSet(nfa.alphabet)}</dd>
        <dt className={sym}>
          q<sub>0</sub>
        </dt>
        <dd className="text-slate-800">= {nfa.start === '' ? <span className="text-red-600">not set</span> : nfa.start}</dd>
        <dt className={sym}>F</dt>
        <dd className="break-words text-slate-800">= {formatSet(nfa.finals)}</dd>
        <dt className={sym}>δ</dt>
        <dd className="text-slate-800">
          <span className="text-slate-500">: Q × (Σ ∪ {'{ε}'}) → 𝒫(Q), with {delta.length} non-empty {delta.length === 1 ? 'entry' : 'entries'}; every other pair maps to ∅.</span>
          {delta.length > 0 && (
            <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-1">
              {delta.map((d) => (
                <li key={`${d.state}|${d.symbol}`} className="whitespace-nowrap">
                  δ({d.state}, <span className={d.symbol === EPSILON ? 'text-accent-700' : undefined}>{d.symbol}</span>) ={' '}
                  {formatSet(d.targets)}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
    </section>
  )
}
