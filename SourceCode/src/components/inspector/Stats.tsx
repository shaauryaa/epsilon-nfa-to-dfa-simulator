import { EPSILON } from '../../core'
import { listTransitions } from '../../model/graph'
import { useApp } from '../../store/automaton'
import { Section } from '../builder/Section'
import { ChartIcon } from '../ui/Icons'

function InfoBox({ label, value, eps }: { label: string; value: number; eps?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
      <dt className="mb-0.5 text-[11px] text-slate-500">{label}</dt>
      <dd className={`font-mono text-sm font-semibold tabular-nums ${eps ? 'text-violet-700' : 'text-slate-900'}`}>{value}</dd>
    </div>
  )
}

/** Counts of states, symbols, symbol transitions and ε-transitions. */
export function Stats() {
  const nfa = useApp((s) => s.nfa)
  const list = listTransitions(nfa)
  const eps = list.filter((t) => t.symbol === EPSILON).length
  return (
    <Section title="Stats" icon={<ChartIcon size={13} />}>
      <dl className="grid grid-cols-2 gap-2">
        <InfoBox label="States" value={nfa.states.length} />
        <InfoBox label="Symbols" value={nfa.alphabet.length} />
        <InfoBox label="Transitions" value={list.length - eps} />
        <InfoBox label="ε-transitions" value={eps} eps />
      </dl>
    </Section>
  )
}
