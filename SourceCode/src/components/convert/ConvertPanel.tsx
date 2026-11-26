import { useState, type ReactNode } from 'react'
import { formatSet } from '../../core'
import { useApp } from '../../store/automaton'
import { useConvert } from '../../store/convert'
import { Section } from '../builder/Section'
import { Button } from '../ui/Button'
import {
  AlertIcon,
  BoltIcon,
  ChartIcon,
  CheckIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  StepBackIcon,
  StepForwardIcon,
  TableIcon,
} from '../ui/Icons'
import { Popover } from '../ui/Popover'
import { DFA_FORMATS, downloadDfa } from './exports'
import { useConvertView, type ConvertView } from './useConversion'

function ControlButton({ label, onClick, disabled, primary, children }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`press grid h-9 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-35 ${
        primary ? 'w-12 bg-blue-600 text-white shadow-sm hover:bg-blue-700' : 'w-9 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (on: boolean) => void; label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 select-none">
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors duration-150 peer-checked:bg-blue-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500" />
        <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-150 peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  )
}

/** Skip back, step back, play/pause, step forward, skip forward, speed and Instant. */
function Player({ total }: { total: number }) {
  const step = useConvert((s) => s.step)
  const playing = useConvert((s) => s.playing)
  const speed = useConvert((s) => s.speed)
  const instant = useConvert((s) => s.instant)
  const c = useConvert.getState()
  const atStart = step === 0
  const atEnd = step >= total - 1
  return (
    <section aria-label="Player" className="border-b border-slate-200 px-4 py-3">
      <div role="toolbar" aria-label="Playback" className="flex items-center justify-between gap-1.5">
        <ControlButton label="Skip back to the start" onClick={c.skipBack} disabled={atStart && !playing}>
          <SkipBackIcon size={15} />
        </ControlButton>
        <ControlButton label="Step back (←)" onClick={c.stepBack} disabled={atStart}>
          <StepBackIcon size={15} />
        </ControlButton>
        <ControlButton primary label={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={c.togglePlay}>
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </ControlButton>
        <ControlButton label="Step forward (→)" onClick={c.stepForward} disabled={atEnd && !playing}>
          <StepForwardIcon size={15} />
        </ControlButton>
        <ControlButton label="Skip to the end" onClick={c.skipForward} disabled={atEnd}>
          <SkipForwardIcon size={15} />
        </ControlButton>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="convert-speed" className="text-xs font-medium text-slate-600">
          Speed
        </label>
        <input
          id="convert-speed"
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onChange={(e) => c.setSpeed(Number(e.target.value))}
          aria-valuetext={`${speed}×`}
          className="h-1.5 min-w-0 flex-1 accent-blue-600"
        />
        <span className="w-10 text-right font-mono text-xs text-slate-700 tabular-nums">{speed}×</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <Switch
          id="convert-instant"
          checked={instant}
          onChange={c.setInstant}
          label={
            <span className="inline-flex items-center gap-1">
              <BoltIcon size={12} className="text-slate-400" /> Instant
            </span>
          }
        />
        <span className="text-[11px] text-slate-500">Space play · ←/→ step</span>
      </div>
    </section>
  )
}

const PHASE_LABEL = { pulse: 'Set S', move: 'move(S, a)', closure: 'ε-closure', dfa: 'DFA state', cell: 'Table', done: 'Finished' } as const

/** The current micro-step's sentence in large type, with the step counter. */
function Explanation({ view }: { view: ConvertView }) {
  const total = view.conversion.result.steps.length
  return (
    <section aria-label="Explanation" className="border-b border-slate-200 bg-slate-50/60 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 tabular-nums">
          Step {view.step.index + 1} of {total}
        </p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">{PHASE_LABEL[view.frame.phase]}</span>
      </div>
      <p aria-live="polite" className="mt-1.5 min-h-[3.75em] text-[17px] leading-snug font-medium text-pretty text-slate-900">
        {view.frame.text}
      </p>
    </section>
  )
}

/** The DFA transition table, filling cell by cell; the current cell is ringed. */
function DfaTable({ view }: { view: ConvertView }) {
  const dfa = view.conversion.result.dfa
  const { progress } = view
  const showDead = useConvert((s) => s.showDead)
  const setShowDead = useConvert((s) => s.setShowDead)
  const live = view.live
  return (
    <Section title="DFA table" icon={<TableIcon size={13} />} meta={`${progress.states.length} / ${dfa.states.length}`}>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-xs">
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
            {progress.states.length === 0 && (
              <tr>
                <td colSpan={dfa.alphabet.length + 1} className="px-2 py-3 text-center text-slate-400">
                  No states yet
                </td>
              </tr>
            )}
            {progress.states.map((s) => {
              const final = dfa.finals.includes(s)
              return (
                <tr key={s} className="border-t border-slate-100">
                  <th scope="row" className={`px-2 py-1.5 text-left font-normal ${live && progress.entering === s ? 'cell-fill' : ''}`}>
                    <span className="font-mono font-semibold text-slate-900">
                      <span className="inline-block w-3 text-blue-600" aria-label={s === dfa.start ? 'start' : undefined}>
                        {s === dfa.start ? '→' : ''}
                      </span>
                      <span className="inline-block w-2.5 text-emerald-600" aria-label={final ? 'final' : undefined}>
                        {final ? '*' : ''}
                      </span>
                      {s}
                    </span>
                    <span className="ml-1 font-mono text-[11px] text-slate-500">= {s === dfa.deadState ? '∅' : formatSet(dfa.subsets[s] ?? [])}</span>
                  </th>
                  {dfa.alphabet.map((a) => {
                    const value = progress.transitions[s]?.[a]
                    const isCurrent = progress.cell?.state === s && progress.cell.symbol === a && view.step.kind === 'transition'
                    const fresh = isCurrent && progress.cellFilled && live
                    return (
                      <td
                        key={a}
                        aria-current={isCurrent ? 'true' : undefined}
                        className={`px-2 py-1.5 text-center font-mono font-semibold ${
                          isCurrent ? 'bg-blue-50 text-blue-800 shadow-[inset_0_0_0_2px_#2563eb]' : 'text-slate-800'
                        } ${fresh ? 'cell-fill' : ''}`}
                      >
                        {value ?? <span className="text-slate-300">·</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Switch id="convert-dead" checked={showDead} onChange={setShowDead} label="Show dead state ∅" />
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          ∅ collects every move to the empty set: it is non-final and loops to itself on every symbol. Hiding it leaves a partial DFA,
          where a missing move means reject.
        </p>
      </div>
    </Section>
  )
}

/** Each state's ε-closure; picking a row highlights it on the ε-NFA. */
function ClosureTable() {
  const closures = useApp((s) => s.closures)
  const picked = useConvert((s) => s.pickedClosure)
  const pick = useConvert((s) => s.pickClosure)
  if (!closures) return null
  return (
    <Section
      title={
        <>
          <span className="normal-case">ε</span>-closures
        </>
      }
      icon={<span className="font-mono text-[13px] text-violet-500">ε</span>}
    >
      <p className="mb-2 text-[11px] text-slate-500">Pick a row to see that closure and its ε-edges on the ε-NFA.</p>
      <ul className="overflow-hidden rounded-lg border border-slate-200" aria-label="ε-closure of each state">
        {Object.entries(closures).map(([s, c]) => {
          const on = picked === s
          return (
            <li key={s} className="border-t border-slate-100 first:border-t-0">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => pick(on ? null : s)}
                className={`flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 ${
                  on ? 'bg-violet-50 text-violet-900' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="w-16 shrink-0 font-semibold">ε-cl({s})</span>
                <span className="min-w-0 break-all">= {formatSet(c)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2" title={hint}>
      <dt className="mb-0.5 text-[11px] text-slate-500">{label}</dt>
      <dd className="truncate font-mono text-sm font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  )
}

/** NFA states, DFA states, the 2^n bound and the construction time. */
function ConvertStats({ view }: { view: ConvertView }) {
  const { stats } = view.conversion.result
  const bound = stats.nfaStates <= 40 ? stats.upperBound.toLocaleString() : `2^${stats.nfaStates}`
  return (
    <Section title="Stats" icon={<ChartIcon size={13} />}>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="NFA states" value={stats.nfaStates} />
        <Stat label="DFA states" value={stats.dfaStates} />
        <Stat label={`Bound 2^${stats.nfaStates}`} value={bound} hint="Subset construction can produce at most 2^n DFA states." />
        <Stat label="Construction time" value={`${stats.ms.toFixed(2)} ms`} />
      </dl>
    </Section>
  )
}

/** "Download DFA": every format with a one-line description. */
function DownloadDfaButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)
  return (
    <>
      <Button
        variant="primary"
        className="w-full"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <DownloadIcon size={15} /> Download DFA
      </Button>
      <Popover open={!!anchor} anchor={anchor} onClose={close} label="Download DFA" width={300}>
        <ul role="menu" aria-label="Download DFA as" className="-m-1 flex max-h-[60vh] flex-col overflow-y-auto">
          {DFA_FORMATS.map((f, i) => (
            <li key={f.id} role="none">
              <button
                type="button"
                role="menuitem"
                autoFocus={i === 0}
                onClick={() => {
                  close()
                  void downloadDfa(f.id)
                }}
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
              >
                <span className="block text-sm font-medium text-slate-900">{f.label}</span>
                <span className="block text-[11px] leading-snug text-slate-500">{f.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  )
}

/** Shown when the last step is reached: start, finals, the mapping and the download. */
function ResultCard({ view }: { view: ConvertView }) {
  const dfa = view.conversion.result.dfa
  return (
    <section aria-labelledby="result-title" className="border-b border-slate-200 px-4 py-4">
      <div className="result-enter rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
        <h3 id="result-title" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
          <CheckIcon size={15} /> Conversion complete
        </h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Start</dt>
          <dd className="font-mono font-semibold text-slate-900">{dfa.start}</dd>
          <dt className="text-slate-500">Final</dt>
          <dd className="font-mono font-semibold break-words text-slate-900">{dfa.finals.length > 0 ? dfa.finals.join(', ') : 'none'}</dd>
        </dl>
        <table className="mt-3 w-full border-collapse overflow-hidden rounded-md text-xs">
          <caption className="sr-only">Subset-to-name mapping</caption>
          <thead>
            <tr className="text-slate-500">
              <th scope="col" className="py-1 pr-2 text-left font-medium">
                DFA
              </th>
              <th scope="col" className="py-1 text-left font-medium">
                NFA states
              </th>
            </tr>
          </thead>
          <tbody>
            {dfa.states.map((s) => (
              <tr key={s} className="border-t border-emerald-100">
                <th scope="row" className="py-1 pr-2 text-left font-mono font-semibold text-slate-900">
                  {s}
                </th>
                <td className="py-1 font-mono break-all text-slate-700">{s === dfa.deadState ? '∅ (dead)' : formatSet(dfa.subsets[s] ?? [])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3.5">
          <DownloadDfaButton />
        </div>
      </div>
    </section>
  )
}

/** Right sidebar in Convert mode while the machine has errors. */
function ConvertErrors() {
  const errors = useApp((s) => s.validation.errors)
  const setTab = useApp((s) => s.setActiveTab)
  return (
    <section className="px-4 py-4">
      <h2 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">Subset construction</h2>
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
          <AlertIcon size={14} className="text-red-600" /> Fix {errors.length === 1 ? 'this error' : `these ${errors.length} errors`} first
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-800">
          {errors.slice(0, 8).map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
          {errors.length > 8 && <li>and {errors.length - 8} more</li>}
        </ul>
        <Button variant="primary" size="sm" className="mt-3" onClick={() => setTab('define')}>
          Go to Define
        </Button>
      </div>
    </section>
  )
}

/** Convert mode's right sidebar: player, explanation, result, DFA table, ε-closures and stats. */
export function ConvertPanel() {
  const view = useConvertView()
  if (!view) return <ConvertErrors />
  const total = view.conversion.result.steps.length
  const finished = view.step.kind === 'done'
  return (
    <>
      <Player total={total} />
      <Explanation view={view} />
      {finished && <ResultCard view={view} />}
      <DfaTable view={view} />
      <ClosureTable />
      <ConvertStats view={view} />
    </>
  )
}
