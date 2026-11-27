import { useMemo } from 'react'
import { formatSet, type DFA } from '../../core'
import { blockColor, equivalenceLine, minimizedEquivalence, setText, showWord, type MinimizeView, type MinStep } from '../../model/minimizeView'
import { useMinimize } from '../../store/minimize'
import { Section } from '../builder/Section'
import { ConvertErrors, DownloadDfaButton, PagedDfaTable, Player, Stat } from '../convert/ConvertPanel'
import { TheoryLink } from '../TheoryLink'
import { AlertIcon, ChartIcon, CheckIcon, TableIcon } from '../ui/Icons'
import { useMinimizeView, type MinimizeViewState } from './useMinimize'

/** Most blocks drawn as chips; the rest are counted. */
const MAX_CHIPS = 60
/** Rows drawn in a DFA table before it switches to pages. */
const MAX_TABLE_ROWS = 60

/** The step counter, the step's sentence and the distinguishing strings. */
function Explanation({ state }: { state: MinimizeViewState }) {
  const { step, min, index } = state
  const alphabet = min.view.input.alphabet
  const witnesses = step.splits.flatMap((sp) => (sp.witness ? [sp.witness] : []))
  return (
    <section aria-label="Explanation" className="border-b border-slate-200 bg-slate-50/60 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 tabular-nums">
          Step {index + 1} of {min.view.steps.length}
        </p>
        <span className="truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">{step.title}</span>
      </div>
      <p aria-live="polite" className="mt-1.5 min-h-[3.75em] text-[15px] leading-snug font-medium text-pretty text-slate-900">
        {step.text}
      </p>
      {witnesses.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
          {witnesses.map((w, i) => (
            <li key={i}>
              Witness <span className="rounded bg-white px-1 font-mono font-semibold text-blue-800 ring-1 ring-slate-200">{showWord(w.word, alphabet)}</span>: from{' '}
              <span className="font-mono font-semibold">{w.accepting}</span> it reaches a final state, from <span className="font-mono font-semibold">{w.rejecting}</span> it does not.
            </li>
          ))}
        </ul>
      )}
      <TheoryLink topic={step.kind === 'complete' ? 'dead' : 'minimise'} />
    </section>
  )
}

/** The current partition as coloured chips, e.g. {A,B,C} {D} {E}. */
function Blocks({ step, phase, prev, brief }: { step: MinStep; phase: string; prev: MinStep | undefined; brief: boolean }) {
  // While the witness plays, the list still shows the blocks before the split.
  const source = phase === 'witness' && prev ? prev : step
  if (!source.blocks) {
    return (
      <Section title="Blocks" icon={<ChartIcon size={13} />}>
        <p className="text-xs text-slate-500">Blocks appear at round 0, after unreachable states are removed and the DFA is complete.</p>
      </Section>
    )
  }
  const blocks = source.blocks
  const shown = blocks.slice(0, MAX_CHIPS)
  return (
    <Section title="Blocks" icon={<ChartIcon size={13} />} meta={`${blocks.length}`}>
      <ul aria-label="Blocks of the partition" className="flex flex-wrap gap-1.5">
        {shown.map((b, i) => {
          const c = blockColor(source.colors[i])
          return (
            <li
              key={formatSet(b)}
              className="block-chip rounded-md border px-2 py-0.5 font-mono text-xs font-semibold break-all"
              style={{ borderColor: c.border, backgroundColor: c.fill, color: c.text }}
            >
              {setText(b, brief)}
            </li>
          )
        })}
        {blocks.length > shown.length && <li className="px-1 py-0.5 text-xs text-slate-500">… and {(blocks.length - shown.length).toLocaleString()} more</li>}
      </ul>
    </Section>
  )
}

/** A DFA transition table; with `colors`, each row is marked with its block colour. */
function DfaTable({ dfa, title, colorOf, meta }: { dfa: DFA; title: string; colorOf?: Record<string, number>; meta?: string }) {
  if (dfa.states.length > MAX_TABLE_ROWS) return <PagedDfaTable key={dfa.states.length} dfa={dfa} />
  return (
    <Section title={title} icon={<TableIcon size={13} />} meta={meta}>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                State
              </th>
              {dfa.alphabet.map((a) => (
                <th key={a} scope="col" className="px-2 py-1.5 text-center font-mono font-semibold">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dfa.states.map((s) => {
              const c = colorOf?.[s]
              return (
                <tr key={s} className="border-t border-slate-100">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                      {c !== undefined && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border" style={{ borderColor: blockColor(c).border, backgroundColor: blockColor(c).fill }} />}
                      <span className="inline-block w-3 text-blue-600">{s === dfa.start ? '→' : ''}</span>
                      <span className="-ml-1 inline-block w-2.5 text-emerald-600">{dfa.finals.includes(s) ? '*' : ''}</span>
                      <span className="break-all">{s}</span>
                    </span>
                  </th>
                  {dfa.alphabet.map((a) => (
                    <td key={a} className="px-2 py-1.5 text-center font-mono font-semibold break-all text-slate-800">
                      {dfa.transitions[s]?.[a] ?? <span className="text-slate-300">·</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

/** Shown at the last step: state counts, merged groups, the equivalence check and the download. */
function ResultCard({ view }: { view: MinimizeView }) {
  const eqLen = 8
  const eq = useMemo(() => minimizedEquivalence(view, eqLen), [view])
  const line = equivalenceLine(eq, eqLen, view.input.alphabet)
  const before = view.input.states.length
  const after = view.result.dfa.states.length
  return (
    <section aria-labelledby="min-result" className="border-b border-slate-200 px-4 py-4">
      <div className="result-enter rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
        <h3 id="min-result" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CheckIcon size={15} /> {view.alreadyMinimal ? 'Already minimal' : 'Minimization complete'}
        </h3>
        <dl className="mt-2.5 grid grid-cols-2 gap-2">
          <Stat label="Before" value={`${before.toLocaleString()} state${before === 1 ? '' : 's'}`} />
          <Stat label="After" value={`${after.toLocaleString()} state${after === 1 ? '' : 's'}`} />
        </dl>
        {view.merged.length > 0 ? (
          <ul aria-label="Merged states" className="mt-2.5 space-y-1 text-xs text-slate-700">
            {view.merged.slice(0, 12).map((m) => (
              <li key={m.name}>
                <span className="font-mono font-semibold text-slate-900">{m.group.join(', ')}</span> merge into <span className="font-mono font-semibold text-slate-900">{m.name}</span>
              </li>
            ))}
            {view.merged.length > 12 && <li className="text-slate-500">and {view.merged.length - 12} more groups</li>}
          </ul>
        ) : (
          <p className="mt-2.5 text-xs text-pretty text-slate-700">No two states are equivalent, so nothing merges.</p>
        )}
        {(view.removed.length > 0 || view.addedDead) && (
          <p className="mt-1.5 text-xs text-pretty text-slate-600">
            {view.removed.length > 0 && `Removed unreachable: ${view.removed.join(', ')}. `}
            {view.addedDead && `Added dead state ${view.addedDead} to complete the DFA.`}
          </p>
        )}
        <p
          role="status"
          className={`mt-3 flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs leading-relaxed ${eq.agree ? 'bg-white text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}
        >
          {eq.agree ? <CheckIcon size={13} className="mt-px shrink-0" /> : <AlertIcon size={13} className="mt-px shrink-0" />}
          <span>{line}</span>
        </p>
        <div className="mt-3.5">
          <DownloadDfaButton which="min" label="Download minimized DFA" large={view.large} />
        </div>
      </div>
    </section>
  )
}

/** Minimize mode's right sidebar: player, explanation, blocks, the result and the tables before and after. */
export function MinimizePanel() {
  const state = useMinimizeView()
  if (!state) return <ConvertErrors title="Minimization" />
  const { min, step, frame, index } = state
  const view = min.view
  const done = step.kind === 'done'
  const colorOf: Record<string, number> = {}
  const shownStep = frame.phase === 'witness' ? view.steps[index - 1] : step
  shownStep?.blocks?.forEach((b, i) => b.forEach((s) => (colorOf[s] = shownStep.colors[i])))
  const workStates = view.work.states.filter((s) => !view.removed.includes(s))
  const workShown: DFA = { ...view.work, states: index >= 1 ? workStates : view.input.states, transitions: index >= 1 ? view.work.transitions : view.input.transitions }
  return (
    <>
      <Player store={useMinimize} id="minimize" label="Minimization player" total={view.steps.length} />
      <Explanation state={state} />
      {done && <ResultCard view={view} />}
      <Blocks step={step} phase={frame.phase} prev={view.steps[index - 1]} brief={view.large} />
      <DfaTable dfa={workShown} title={done ? 'Before: DFA table' : 'DFA table'} colorOf={colorOf} meta={`${workShown.states.length}`} />
      {done && <DfaTable dfa={view.result.dfa} title="After: minimal DFA" colorOf={view.minColors} meta={`${view.result.dfa.states.length}`} />}
    </>
  )
}
