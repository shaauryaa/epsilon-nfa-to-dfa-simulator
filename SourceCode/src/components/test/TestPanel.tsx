import { Fragment, useEffect, useId, useState, type ReactNode } from 'react'
import { checkEquivalence, formatSet } from '../../core'
import {
  batchSummary,
  dfaTraceCells,
  equivalenceMessage,
  expectedBatchText,
  nfaTraceCells,
  showString,
  statusLabel,
  type BatchRow,
  type TraceCell,
  type Verdict,
} from '../../model/testRun'
import { useApp } from '../../store/automaton'
import { EQUIV_LEN, useTest } from '../../store/test'
import { fieldClass, Section } from '../builder/Section'
import { ConvertErrors, Player } from '../convert/ConvertPanel'
import { useConversion } from '../convert/useConversion'
import { Button } from '../ui/Button'
import { AlertIcon, ArrowsIcon, CheckIcon, CloseIcon, DownloadIcon, PlayIcon, TableIcon, TextIcon } from '../ui/Icons'
import { downloadBatchCSV } from './testExports'
import { useBatchRows, usePresetExpected, useTestRun, useTestView, type TestView } from './testData'

/** The input box, the ε button and the symbols as chips (or the bad-symbol error). */
function InputSection() {
  const input = useTest((s) => s.input) ?? ''
  const setInput = useTest((s) => s.setInput)
  const run = useTestRun()
  const alphabet = useApp((s) => s.nfa.alphabet)
  const hintId = useId()
  const errorId = useId()
  const check = run?.check
  const bad = check && !check.ok
  return (
    <Section title="Input string" icon={<TextIcon size={13} />}>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-label="Input string"
          aria-invalid={bad || undefined}
          aria-describedby={bad ? errorId : hintId}
          placeholder="e.g. abb"
          className={`${fieldClass} h-9 min-w-0 flex-1 font-mono ${bad ? 'border-red-400' : 'border-slate-300'}`}
        />
        <Button size="sm" className="h-9 shrink-0" onClick={() => setInput('')} title="Test the empty string ε" aria-label="Use the empty string ε">
          <span className="font-mono text-violet-700">ε</span> (empty)
        </Button>
      </div>
      <p id={hintId} className="mt-1.5 text-[11px] text-slate-500">
        Leave empty or type ε for the empty string. Σ = {'{'}
        {alphabet.join(', ')}
        {'}'}
      </p>
      {bad ? (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
          <AlertIcon size={13} className="mt-px shrink-0 text-red-600" />
          <span>
            {check.message} This is an invalid input, not a rejection.
          </span>
        </p>
      ) : (
        check?.ok && (
          <ul aria-label="Symbols" className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {check.tokens.length === 0 ? (
              <li className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-xs text-violet-800">ε</li>
            ) : (
              check.tokens.map((t, i) => (
                <li key={i} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                  {t}
                </li>
              ))
            )}
          </ul>
        )
      )}
    </Section>
  )
}

function InfoBox({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 ${wide ? 'col-span-2' : ''}`}>
      <dt className="mb-0.5 text-[11px] text-slate-500">{label}</dt>
      <dd className={`font-mono text-sm font-semibold text-slate-900 ${wide ? 'break-all' : 'truncate'}`}>{value}</dd>
    </div>
  )
}

/** Step counter and the current frame's sentence. */
function RunExplanation({ view }: { view: TestView }) {
  const total = view.run.trace.steps.length + 1
  const text = view.frame?.text ?? ''
  return (
    <section aria-label="Explanation" className="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
      <p className="text-xs font-semibold text-slate-500 tabular-nums">
        Step {view.step} of {total - 1}
        {view.step === 0 ? ' · start' : ` · symbol ${view.run.trace.steps[view.step - 1].symbol}`}
      </p>
      <p aria-live="polite" className="mt-1 min-h-[3.4em] text-[15px] leading-snug font-medium text-pretty text-slate-900">
        {text}
      </p>
    </section>
  )
}

/** The reference's info boxes: active states, DFA state, symbol read, consumed, remaining. */
function LiveState({ view }: { view: TestView }) {
  const alphabet = useApp((s) => s.nfa.alphabet)
  const { trace } = view.run
  const step = view.step
  const s = step > 0 ? trace.steps[step - 1] : null
  const active = s ? s.nfaAfter : trace.nfa.initial
  const dfaState = s ? (s.dfaTo ?? '— (stopped)') : trace.dfa.path[0]
  return (
    <section aria-label="Live state" className="border-b border-slate-200 px-4 py-3">
      <dl className="grid grid-cols-2 gap-2">
        <InfoBox wide label="Active states (ε-NFA)" value={formatSet(active)} />
        <InfoBox label="DFA state" value={dfaState} />
        <InfoBox label="Symbol read" value={s ? s.symbol : '—'} />
        <InfoBox label="Consumed" value={step === 0 ? '(start)' : showString(trace.tokens.slice(0, step), alphabet)} />
        <InfoBox label="Remaining" value={step >= trace.tokens.length ? '(done)' : showString(trace.tokens.slice(step), alphabet)} />
      </dl>
    </section>
  )
}

function VerdictBadge({ accepted, label }: { accepted: boolean; label: string }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${accepted ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      <span className="text-xs font-medium">{label}</span>
      <span className="flex items-center gap-1 text-xs font-bold tracking-wide">
        {accepted ? <CheckIcon size={13} /> : <CloseIcon size={13} />}
        {accepted ? 'ACCEPTED' : 'REJECTED'}
      </span>
    </div>
  )
}

/** Verdicts for both machines and whether they agree; shown once the run reaches its end. */
function Verdicts({ view }: { view: TestView }) {
  const { trace } = view.run
  if (!view.atEnd) {
    return (
      <section aria-label="Result" className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">The verdict appears after the last symbol.</p>
      </section>
    )
  }
  return (
    <section aria-label="Result" className="border-b border-slate-200 px-4 py-3">
      <div className="result-enter grid gap-1.5">
        <VerdictBadge label="ε-NFA" accepted={trace.nfaAccepted} />
        <VerdictBadge label="DFA" accepted={trace.dfaAccepted} />
        <p
          className={`mt-0.5 flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${trace.agree ? 'bg-blue-50 text-blue-800' : 'bg-red-600 text-white'}`}
        >
          {trace.agree ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
          {trace.agree ? 'Both machines agree' : 'The machines disagree'}
        </p>
      </div>
    </section>
  )
}

/** Most trace cells drawn; the CSV download has every step. */
const MAX_TRACE_CELLS = 120

function TraceRow({ title, cells, current, onPick }: { title: string; cells: TraceCell[]; current: number; onPick?: (i: number) => void }) {
  const shown = cells.slice(0, MAX_TRACE_CELLS)
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-semibold text-slate-500">{title}</h3>
      <ol aria-label={title} className="flex flex-wrap items-center gap-y-1.5 font-mono text-xs">
        {shown.map((c, i) => (
          <Fragment key={i}>
            {c.symbol !== null && (
              <li aria-hidden="true" className="px-1 text-slate-400">
                —<span className="font-semibold text-blue-700">{c.symbol}</span>→
              </li>
            )}
            <li>
              <button
                type="button"
                disabled={!onPick}
                onClick={() => onPick?.(i)}
                aria-current={i === current ? 'step' : undefined}
                aria-label={`${c.symbol === null ? 'Start' : `After ${c.symbol}`}: ${c.value}`}
                className={`rounded px-1.5 py-0.5 break-all transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  i === current ? 'bg-blue-600 text-white' : i < current ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-500'
                } ${onPick ? 'hover:ring-1 hover:ring-blue-300' : ''}`}
              >
                {c.value}
              </button>
            </li>
          </Fragment>
        ))}
        {cells.length > shown.length && <li className="px-1 text-slate-500">… {cells.length - shown.length} more (see the CSV)</li>}
      </ol>
    </div>
  )
}

/** The ε-NFA trace as a row of sets and the DFA trace as a row of states, each step labelled with its symbol. */
function Traces({ view }: { view: TestView }) {
  const jump = useTest((s) => s.jump)
  const animated = view.run.plan.length > 0
  return (
    <Section title="Trace" icon={<ArrowsIcon size={13} />}>
      <div className="grid gap-3">
        <TraceRow title="ε-NFA (sets after ε-closure)" cells={nfaTraceCells(view.run.trace)} current={view.step} onPick={animated ? jump : undefined} />
        <TraceRow title="DFA (path)" cells={dfaTraceCells(view.run.trace)} current={view.step} onPick={animated ? jump : undefined} />
      </div>
    </Section>
  )
}

const VERDICT_TEXT: Record<Verdict, string> = { accept: 'Accept', reject: 'Reject' }

function VerdictCell({ v }: { v: Verdict | null }) {
  if (v === null) return <span className="text-slate-400">—</span>
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${v === 'accept' ? 'text-emerald-700' : 'text-slate-600'}`} title={VERDICT_TEXT[v]}>
      {v === 'accept' ? <CheckIcon size={12} /> : <CloseIcon size={12} />}
      <span className="sr-only">{VERDICT_TEXT[v]}</span>
    </span>
  )
}

function StatusCell({ row }: { row: BatchRow }) {
  const cls =
    row.status === 'pass' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : row.status === 'fail' ? 'bg-red-600 text-white ring-red-600' : 'bg-amber-50 text-amber-800 ring-amber-200'
  return <span className={`rounded px-1.5 py-px text-[10px] font-bold tracking-wide ring-1 ${cls}`}>{statusLabel(row.status)}</span>
}

/** Batch tester: one string per line, the results table with expected vs generated, summary and CSV export. */
function BatchSection() {
  const text = useTest((s) => s.batchText)
  const setText = useTest((s) => s.setBatchText)
  const runBatch = useTest((s) => s.runBatch)
  const ran = useTest((s) => s.batchRun)
  const rows = useBatchRows()
  const expected = usePresetExpected()
  const summary = rows ? batchSummary(rows) : null
  const areaId = useId()
  const stale = ran !== null && ran !== text

  const seed = () => {
    if (!expected) return
    setText(expectedBatchText(expected))
    useTest.getState().runBatch()
  }

  return (
    <Section title="Batch test" icon={<TableIcon size={13} />} meta={summary ? `${summary.pass}/${summary.total} pass` : undefined}>
      <label htmlFor={areaId} className="mb-1 block text-[11px] text-slate-500">
        One string per line. An empty line or <span className="font-mono">eps</span> is ε.
      </label>
      <textarea
        id={areaId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={5}
        placeholder={'abb\naabb\neps'}
        className="block w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/12"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button variant="primary" size="sm" onClick={runBatch} disabled={text === ''}>
          <PlayIcon size={13} /> Run
        </Button>
        <Button size="sm" onClick={seed} disabled={!expected} title={expected ? 'Fill in the preset’s expected accepted and rejected strings and run them' : 'Only presets come with expected strings'}>
          Load expected strings
        </Button>
        <Button size="sm" onClick={() => void downloadBatchCSV()} disabled={!rows || rows.length === 0} aria-label="Export the batch results as CSV">
          <DownloadIcon size={13} /> CSV
        </Button>
      </div>
      {stale && <p className="mt-2 text-[11px] text-amber-700">The text changed since the last run. Run again to update the table.</p>}
      {rows && summary && (
        <>
          <p
            role="status"
            className={`mt-3 rounded-md px-2.5 py-1.5 text-xs font-semibold tabular-nums ${summary.fail > 0 ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'}`}
          >
            {summary.text}
          </p>
          {summary.withExpected > 0 && <p className="mt-1 text-[11px] text-slate-500">{summary.withExpected} rows compared with the preset’s expected result.</p>}
          <div className="mt-2 max-h-[340px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">Batch results: expected and generated verdicts</caption>
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] text-slate-600">
                <tr>
                  <th scope="col" className="px-1.5 py-1.5 text-right font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-1.5 py-1.5 text-left font-semibold">
                    String
                  </th>
                  <th scope="col" className="px-1 py-1.5 font-semibold" title="Expected (from the preset)">
                    Exp.
                  </th>
                  <th scope="col" className="px-1 py-1.5 font-semibold">
                    ε-NFA
                  </th>
                  <th scope="col" className="px-1 py-1.5 font-semibold">
                    DFA
                  </th>
                  <th scope="col" className="px-1 py-1.5 font-semibold" title="Minimized DFA">
                    Min
                  </th>
                  <th scope="col" className="px-1.5 py-1.5 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} className={`border-t border-slate-100 ${r.status === 'fail' ? 'bg-red-50' : ''}`}>
                    <td className="px-1.5 py-1 text-right text-slate-400 tabular-nums">{r.index}</td>
                    <td className="max-w-[96px] truncate px-1.5 py-1 font-mono text-slate-900" title={r.error ?? r.display}>
                      {r.display === 'ε' ? <span className="text-violet-700">ε</span> : r.display}
                    </td>
                    <td className="px-1 py-1 text-center">
                      <VerdictCell v={r.expected} />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <VerdictCell v={r.nfa} />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <VerdictCell v={r.dfa} />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <VerdictCell v={r.min} />
                    </td>
                    <td className="px-1.5 py-1 text-center" title={r.error ?? undefined}>
                      <StatusCell row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-0.5 text-emerald-700">
              <CheckIcon size={11} /> accept
            </span>
            <span className="inline-flex items-center gap-0.5 text-slate-600">
              <CloseIcon size={11} /> reject
            </span>
            <span>PASS: all agree (and match the expected result)</span>
          </p>
        </>
      )}
    </Section>
  )
}

/** Bounded equivalence check between the ε-NFA and the DFA. */
function EquivalenceSection() {
  const nfa = useApp((s) => s.nfa)
  const conversion = useConversion()
  const maxLen = useTest((s) => s.maxLen)
  const setMaxLen = useTest((s) => s.setMaxLen)
  const eq = useTest((s) => s.equivalence)
  const setEq = useTest((s) => s.setEquivalence)
  const [busy, setBusy] = useState(false)
  const sliderId = useId()
  const current = eq && eq.nfa === nfa ? eq : null
  const message = current ? equivalenceMessage(current.result, current.maxLen, nfa.alphabet) : null

  const verify = () => {
    if (!conversion) return
    setBusy(true)
    // Let the button show its busy state before the check runs.
    window.setTimeout(() => {
      const result = checkEquivalence(nfa, conversion.result.dfa, maxLen)
      setEq({ nfa, maxLen, result })
      setBusy(false)
    }, 16)
  }

  return (
    <Section title="Equivalence check" icon={<CheckIcon size={13} />}>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">Runs both machines on every string over Σ up to the length below (at most 100,000 strings).</p>
      <div className="flex items-center gap-3">
        <label htmlFor={sliderId} className="text-xs font-medium text-slate-600">
          Max length
        </label>
        <input
          id={sliderId}
          type="range"
          min={EQUIV_LEN.min}
          max={EQUIV_LEN.max}
          step={1}
          value={maxLen}
          onChange={(e) => setMaxLen(Number(e.target.value))}
          className="h-1.5 min-w-0 flex-1 accent-blue-600"
        />
        <span className="w-6 text-right font-mono text-xs text-slate-700 tabular-nums">{maxLen}</span>
      </div>
      <Button variant="primary" size="sm" className="mt-2.5" onClick={verify} disabled={busy || !conversion}>
        {busy ? 'Checking…' : 'Verify'}
      </Button>
      {message && (
        <p
          role="status"
          className={`mt-2.5 flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs leading-relaxed ${message.ok ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}
        >
          {message.ok ? <CheckIcon size={13} className="mt-px shrink-0" /> : <AlertIcon size={13} className="mt-px shrink-0" />}
          <span>{message.text}</span>
        </p>
      )}
    </Section>
  )
}

/** Seeds the input with the preset's first accepted string the first time the tab opens. */
function useSeedInput() {
  const input = useTest((s) => s.input)
  const presetId = useApp((s) => s.presetId)
  const expected = usePresetExpected()
  useEffect(() => {
    if (input === null) useTest.getState().setInput(expected?.accepts[0] ?? '')
  }, [input, presetId, expected])
}

/** Test mode's right sidebar: input, player, live state, verdicts, traces, batch tester and equivalence check. */
export function TestPanel() {
  useSeedInput()
  const conversion = useConversion()
  const run = useTestRun()
  const view = useTestView()
  if (!conversion || !run) return <ConvertErrors title="Test strings" />
  const animated = run.plan.length > 0
  return (
    <>
      <InputSection />
      {view && animated && <Player store={useTest} id="test" label="Run player" total={run.plan.length} />}
      {view && animated && <RunExplanation view={view} />}
      {view && <LiveState view={view} />}
      {view && <Verdicts view={view} />}
      {view && <Traces view={view} />}
      <BatchSection />
      <EquivalenceSection />
    </>
  )
}
