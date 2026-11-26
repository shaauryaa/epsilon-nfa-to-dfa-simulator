import { EPSILON } from '../../core'
import { formatTargets } from '../../model/edits'
import { useApp } from '../../store/automaton'
import { Section } from '../builder/Section'
import { SigmaIcon } from '../ui/Icons'

const sym = 'font-semibold text-slate-500'

/** The machine written as the 5-tuple M = (Q, Σ, δ, q₀, F) with its actual values. */
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
    <Section title="Formal definition" icon={<SigmaIcon size={13} />}>
      <p className="mb-2 font-mono text-xs text-slate-700">
        M = (Q, Σ, δ, q<sub>0</sub>, F)
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1 font-mono text-xs text-slate-800">
        <dt className={sym}>Q</dt>
        <dd className="break-words">= {formatTargets(nfa.states)}</dd>
        <dt className={sym}>Σ</dt>
        <dd className="break-words">= {formatTargets(nfa.alphabet)}</dd>
        <dt className={sym}>
          q<sub>0</sub>
        </dt>
        <dd>= {nfa.start === '' ? <span className="font-sans text-red-600">not set</span> : nfa.start}</dd>
        <dt className={sym}>F</dt>
        <dd className="break-words">= {formatTargets(nfa.finals)}</dd>
        <dt className={sym}>δ</dt>
        <dd className="text-slate-500">
          : Q × (Σ ∪ {'{'}
          <span className="text-violet-600">ε</span>
          {'}'}) → 𝒫(Q)
        </dd>
      </dl>
      {delta.length > 0 ? (
        <>
          <ul
            aria-label="Transition function"
            className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[11px] text-slate-800"
          >
            {delta.map((d) => (
              <li key={`${d.state}|${d.symbol}`} className="break-words" title={`δ(${d.state}, ${d.symbol}) = ${formatTargets(d.targets)}`}>
                δ({d.state}, <span className={d.symbol === EPSILON ? 'text-violet-600' : undefined}>{d.symbol}</span>) ={' '}
                {formatTargets(d.targets)}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-slate-500">Every other pair maps to ∅.</p>
        </>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No transitions yet; every pair maps to ∅.</p>
      )}
    </Section>
  )
}
