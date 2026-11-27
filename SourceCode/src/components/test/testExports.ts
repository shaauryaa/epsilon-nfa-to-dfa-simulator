import { checkEquivalence, exportFileName } from '../../core'
import { saveText } from '../../lib/download'
import type { ReportTests } from '../../lib/report'
import { batchCSV, batchSummary, dfaTraceCells, nfaTraceCells, singleRunCSV, traceText, equivalenceMessage, showString, type TraceCell } from '../../model/testRun'
import { useApp } from '../../store/automaton'
import { useTest } from '../../store/test'
import { machineName, run } from '../convert/exports'
import { computeBatch, currentBatch, currentMachines, currentRun, presetExpected } from './testData'

/** Downloads the single-string result (verdicts and the step-by-step trace) as CSV. */
export function downloadRunCSV(): Promise<void> {
  return run('test result', () => {
    const r = currentRun()
    if (!r) return null
    const name = exportFileName(machineName().slug, 'string-test', 'csv', new Date())
    saveText(name, singleRunCSV(r.input, r.check, r.trace, useApp.getState().nfa.alphabet), 'text/csv')
    return name
  })
}

/**
 * Downloads the batch table as CSV. Before any batch run it uses the
 * preset's expected strings.
 */
export function downloadBatchCSV(): Promise<void> {
  return run('batch results', () => {
    const rows = currentBatch() ?? defaultBatch()
    if (!rows) throw new Error('run a batch first (this machine has no expected strings).')
    const name = exportFileName(machineName().slug, 'batch-test', 'csv', new Date())
    saveText(name, batchCSV(rows), 'text/csv')
    return name
  })
}

/** Most trace cells printed in the report; the CSV has every step. */
const REPORT_TRACE_CELLS = 60

function shortTrace(cells: TraceCell[]): string {
  const text = traceText(cells.slice(0, REPORT_TRACE_CELLS))
  return cells.length > REPORT_TRACE_CELLS ? `${text} … (${cells.length - REPORT_TRACE_CELLS} more steps in the CSV download)` : text
}

/** The batch run on the preset's expected strings, used when no batch was run yet. */
function defaultBatch() {
  const m = currentMachines()
  const expected = presetExpected()
  if (!m || !expected) return null
  return computeBatch(m, [...expected.accepts, ...expected.rejects].map((s) => (s.trim() === '' ? 'eps' : s)).join('\n'), expected)
}

/**
 * The test results for the PDF report: the current string, the last batch
 * (or the preset's expected strings) and the last equivalence check.
 *
 * @returns The report section's data, or `null` while the machine has errors.
 */
export function reportTests(): ReportTests | null {
  const m = currentMachines()
  if (!m) return null
  const alphabet = m.nfa.alphabet
  const r = currentRun()
  const rows = currentBatch() ?? defaultBatch()
  const eq = useTest.getState().equivalence
  return {
    single:
      r && r.trace
        ? {
            input: showString(r.trace.tokens, alphabet),
            nfaAccepted: r.trace.nfaAccepted,
            dfaAccepted: r.trace.dfaAccepted,
            nfaTrace: shortTrace(nfaTraceCells(r.trace)),
            dfaTrace: shortTrace(dfaTraceCells(r.trace)),
          }
        : r
          ? { input: r.input, invalid: r.check.ok ? '' : r.check.message }
          : null,
    batch: rows ? { rows, summary: batchSummary(rows).text, fromPreset: currentBatch() === null } : null,
    // Without a check from the Test tab, the report runs a short one (length 6, at most 20,000 strings).
    equivalence: eq && eq.nfa === m.nfa ? equivalenceMessage(eq.result, eq.maxLen, alphabet) : equivalenceMessage(checkEquivalence(m.nfa, m.dfa, 6, 20000), 6, alphabet),
  }
}
