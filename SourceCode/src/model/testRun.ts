/**
 * The Test tab's model: checking an input string against Σ, running it on
 * the ε-NFA and the DFA side by side, batch runs with expected results, the
 * equivalence message and the CSV exports. Pure TypeScript, no UI.
 */

import {
  InputSymbolError,
  formatSet,
  rowsToCSV,
  simulateDFA,
  simulateENFA,
  tokenize,
  type DFA,
  type DFASimulation,
  type ENFA,
  type ENFASimulation,
  type EquivalenceResult,
} from '../core'

/** Input runs longer than this are shown as text and tables only (no per-symbol animation). */
export const MAX_ANIMATED_SYMBOLS = 200

/** The result of checking an input string against the alphabet. */
export type InputCheck =
  | { ok: true; tokens: string[] }
  | {
      ok: false
      /** The first piece of input that is not a symbol. */
      symbol: string
      /** 0-based character position of `symbol` in the input, as in `InputSymbolError` and the test report. */
      position: number
      /** 1-based number of the bad symbol in the input, as shown to people. */
      symbolNumber: number
      message: string
    }

/**
 * Splits an input string into symbols, turning a bad symbol into an error
 * value (it is not a rejection: the string is not over Σ at all).
 *
 * @param input - The raw input; empty, blank or a lone `ε` means the empty string.
 * @param alphabet - Σ.
 * @returns The tokens, or the bad symbol, its 0-based position (in
 *   characters, so `ε` or an emoji counts as one), its 1-based symbol
 *   number and a message that uses the 1-based number.
 * @throws Never throws; errors other than {@link InputSymbolError} are rethrown.
 */
export function checkInput(input: string, alphabet: readonly string[]): InputCheck {
  try {
    return { ok: true, tokens: tokenize(input, alphabet) }
  } catch (e) {
    if (!(e instanceof InputSymbolError)) throw e
    const position = [...input.slice(0, e.position)].length
    // People count from 1: the bad piece is symbol n of the input (symbols before it, plus one).
    const symbolNumber = tokenize(input.slice(0, e.position), alphabet).length + 1
    return {
      ok: false,
      symbol: e.character,
      position,
      symbolNumber,
      message: `“${e.character}” (symbol ${symbolNumber}) is not in Σ = {${alphabet.join(', ')}}.`,
    }
  }
}

/**
 * Writes a symbol sequence for display.
 *
 * @param tokens - The symbols.
 * @param alphabet - Σ; symbols are separated by spaces when any symbol is longer than one character.
 * @returns The string, or `ε` for the empty sequence.
 * @throws Never throws.
 */
export function showString(tokens: readonly string[], alphabet: readonly string[]): string {
  if (tokens.length === 0) return 'ε'
  return tokens.join(alphabet.every((s) => [...s].length === 1) ? '' : ' ')
}

/** One symbol of a side-by-side run. */
export interface TraceStep {
  /** 1-based number of the symbol. */
  index: number
  symbol: string
  /** ε-NFA set before reading the symbol. */
  nfaBefore: string[]
  /** move(before, symbol). */
  nfaMoved: string[]
  /** ε-closure(moved): the set after the symbol. */
  nfaAfter: string[]
  /** DFA state before the symbol; `null` once a partial DFA has stopped. */
  dfaFrom: string | null
  /** DFA state after the symbol; `null` when there is no move (or the run had already stopped). */
  dfaTo: string | null
}

/** A string run on both machines. */
export interface RunTrace {
  tokens: string[]
  nfa: ENFASimulation
  dfa: DFASimulation
  steps: TraceStep[]
  nfaAccepted: boolean
  dfaAccepted: boolean
  /** True when both machines give the same verdict. */
  agree: boolean
  /** 1-based number of the symbol on which a partial DFA had no move, or `null`. */
  dfaStuckAt: number | null
}

/**
 * Runs one input on the ε-NFA and the DFA and lines the two runs up symbol
 * by symbol.
 *
 * @param nfa - The ε-NFA (assumed valid).
 * @param dfa - A DFA for it (complete or partial).
 * @param tokens - The input symbols (`[]` is ε).
 * @returns Both simulations, one {@link TraceStep} per symbol and the verdicts.
 * @throws Never throws.
 */
export function buildTrace(nfa: ENFA, dfa: DFA, tokens: readonly string[]): RunTrace {
  const n = simulateENFA(nfa, tokens)
  const d = simulateDFA(dfa, tokens)
  const stuck = d.steps.findIndex((s) => s.to === null)
  const steps = n.steps.map((s, i): TraceStep => {
    const ds = d.steps[i]
    return {
      index: i + 1,
      symbol: s.symbol,
      nfaBefore: s.before,
      nfaMoved: s.moved,
      nfaAfter: s.after,
      dfaFrom: ds ? ds.from : null,
      dfaTo: ds ? ds.to : null,
    }
  })
  return {
    tokens: [...tokens],
    nfa: n,
    dfa: d,
    steps,
    nfaAccepted: n.accepted,
    dfaAccepted: d.accepted,
    agree: n.accepted === d.accepted,
    dfaStuckAt: stuck >= 0 ? stuck + 1 : null,
  }
}

/** One cell of a trace row: the state(s) reached and the symbol that led there (none for the first). */
export interface TraceCell {
  symbol: string | null
  value: string
}

/**
 * The ε-NFA trace as a row of sets: {0,1,2,4,7} —a→ {1,2,3,4,6,7,8} …
 *
 * @param trace - From {@link buildTrace}.
 * @returns The start set, then one cell per symbol.
 * @throws Never throws.
 */
export function nfaTraceCells(trace: RunTrace): TraceCell[] {
  return [{ symbol: null, value: formatSet(trace.nfa.initial) }, ...trace.steps.map((s) => ({ symbol: s.symbol, value: formatSet(s.nfaAfter) }))]
}

/**
 * The DFA trace as a row of states: A —a→ B —b→ D … A missing move of a
 * partial DFA shows as `—` and ends the row.
 *
 * @param trace - From {@link buildTrace}.
 * @returns The start state, then one cell per symbol read.
 * @throws Never throws.
 */
export function dfaTraceCells(trace: RunTrace): TraceCell[] {
  return [{ symbol: null, value: trace.dfa.path[0] }, ...trace.dfa.steps.map((s) => ({ symbol: s.symbol, value: s.to ?? '— (no move)' }))]
}

/**
 * Writes trace cells on one line.
 *
 * @param cells - From {@link nfaTraceCells} or {@link dfaTraceCells}.
 * @returns E.g. `A —a→ B —b→ D`.
 * @throws Never throws.
 */
export function traceText(cells: readonly TraceCell[]): string {
  return cells.map((c) => (c.symbol === null ? c.value : ` —${c.symbol}→ ${c.value}`)).join('')
}

/** Accept or reject. */
export type Verdict = 'accept' | 'reject'

/** One line of the batch tester. */
export interface BatchRow {
  /** 1-based row number. */
  index: number
  /** The line as typed, after trimming (`''` for ε). */
  raw: string
  /** The string for display (`ε` for the empty string). */
  display: string
  /** Set when the line has a symbol outside Σ; the results are then `null`. */
  error: string | null
  /** The expected verdict, when known. */
  expected: Verdict | null
  nfa: Verdict | null
  dfa: Verdict | null
  min: Verdict | null
  /**
   * `pass`: all three machines agree, and with the expected verdict when
   * there is one. `fail`: some machine disagrees. `invalid`: not a string over Σ.
   */
  status: 'pass' | 'fail' | 'invalid'
}

/** The machines a batch runs on. */
export interface Machines {
  nfa: ENFA
  dfa: DFA
  min: DFA
}

/**
 * Reads the batch textarea: one string per line. An empty line or the word
 * `eps` (or a lone `ε`) is the empty string. Blank lines at the very end
 * are ignored, so a trailing newline does not add an ε row.
 *
 * @param text - The textarea contents.
 * @returns The lines, trimmed, with ε as `''`.
 * @throws Never throws.
 */
export function parseBatch(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((l) => (l === 'eps' || l === 'ε' ? '' : l))
}

const keyOf = (tokens: readonly string[]) => tokens.join('\u0001')

/**
 * Indexes a preset's expected strings by their symbol sequence, so `if x`
 * and `ifx` find the same entry.
 *
 * @param expected - The preset's accept and reject lists (raw strings).
 * @param alphabet - Σ, used to split the strings.
 * @returns Symbol-sequence key → expected verdict. Strings not over Σ are skipped.
 * @throws Never throws.
 */
export function expectedIndex(expected: { accepts: readonly string[]; rejects: readonly string[] }, alphabet: readonly string[]): Map<string, Verdict> {
  const map = new Map<string, Verdict>()
  const add = (raw: string, v: Verdict) => {
    const c = checkInput(raw, alphabet)
    if (c.ok) map.set(keyOf(c.tokens), v)
  }
  expected.accepts.forEach((s) => add(s, 'accept'))
  expected.rejects.forEach((s) => add(s, 'reject'))
  return map
}

/**
 * The batch textarea text for a preset's expected strings: accepted ones
 * first, then rejected ones, with ε written as `eps`.
 *
 * @param expected - The preset's accept and reject lists.
 * @returns One string per line.
 * @throws Never throws.
 */
export function expectedBatchText(expected: { accepts: readonly string[]; rejects: readonly string[] }): string {
  return [...expected.accepts, ...expected.rejects].map((s) => (s.trim() === '' ? 'eps' : s)).join('\n')
}

const verdict = (accepted: boolean): Verdict => (accepted ? 'accept' : 'reject')

/**
 * Runs every line on the ε-NFA, the DFA and the minimal DFA and compares
 * the results with each other and with the expected verdict.
 *
 * @param lines - From {@link parseBatch}.
 * @param m - The three machines.
 * @param expected - From {@link expectedIndex}; lines not in it have no expected verdict.
 * @returns One row per line.
 * @throws Never throws.
 */
export function runBatch(lines: readonly string[], m: Machines, expected: ReadonlyMap<string, Verdict> = new Map()): BatchRow[] {
  return lines.map((raw, i) => {
    const c = checkInput(raw, m.nfa.alphabet)
    if (!c.ok) {
      return { index: i + 1, raw, display: raw, error: c.message, expected: null, nfa: null, dfa: null, min: null, status: 'invalid' }
    }
    const nfa = verdict(simulateENFA(m.nfa, c.tokens).accepted)
    const dfa = verdict(simulateDFA(m.dfa, c.tokens).accepted)
    const min = verdict(simulateDFA(m.min, c.tokens).accepted)
    const exp = expected.get(keyOf(c.tokens)) ?? null
    const agree = nfa === dfa && dfa === min && (exp === null || exp === nfa)
    return {
      index: i + 1,
      raw,
      display: c.tokens.length === 0 ? 'ε' : raw,
      error: null,
      expected: exp,
      nfa,
      dfa,
      min,
      status: agree ? 'pass' : 'fail',
    }
  })
}

/** Counts for the batch summary line. */
export interface BatchSummary {
  total: number
  pass: number
  fail: number
  invalid: number
  /** Rows that had an expected verdict. */
  withExpected: number
  accepted: number
  rejected: number
  text: string
}

/**
 * Summarises a batch run.
 *
 * @param rows - From {@link runBatch}.
 * @returns The counts and a one-line summary, e.g. "14 strings: 14 pass, 0 fail (6 accepted, 8 rejected)".
 * @throws Never throws.
 */
export function batchSummary(rows: readonly BatchRow[]): BatchSummary {
  const count = (f: (r: BatchRow) => boolean) => rows.filter(f).length
  const pass = count((r) => r.status === 'pass')
  const fail = count((r) => r.status === 'fail')
  const invalid = count((r) => r.status === 'invalid')
  const accepted = count((r) => r.nfa === 'accept')
  const rejected = count((r) => r.nfa === 'reject')
  const total = rows.length
  const parts = [`${pass} pass`, `${fail} fail`]
  if (invalid > 0) parts.push(`${invalid} invalid`)
  const text = `${total} string${total === 1 ? '' : 's'}: ${parts.join(', ')} (${accepted} accepted, ${rejected} rejected)`
  return { total, pass, fail, invalid, withExpected: count((r) => r.expected !== null), accepted, rejected, text }
}

const word = (v: Verdict | null) => (v === 'accept' ? 'Accept' : v === 'reject' ? 'Reject' : '—')
const statusWord = (s: BatchRow['status']) => (s === 'pass' ? 'PASS' : s === 'fail' ? 'FAIL' : 'INVALID')

/**
 * The batch table as CSV.
 *
 * @param rows - From {@link runBatch}.
 * @returns CSV with the columns #, String, Expected, ε-NFA, DFA, Min-DFA, Status, Note.
 * @throws Never throws.
 */
export function batchCSV(rows: readonly BatchRow[]): string {
  return rowsToCSV([
    ['#', 'String', 'Expected', 'ε-NFA', 'DFA', 'Min-DFA', 'Status', 'Note'],
    ...rows.map((r) => [String(r.index), r.display, word(r.expected), word(r.nfa), word(r.dfa), word(r.min), statusWord(r.status), r.error ?? '']),
  ])
}

/**
 * The batch row's status as printed in tables and CSV.
 *
 * @param s - A row status.
 * @returns `PASS`, `FAIL` or `INVALID`.
 * @throws Never throws.
 */
export function statusLabel(s: BatchRow['status']): string {
  return statusWord(s)
}

/**
 * A verdict as printed in tables.
 *
 * @param v - A verdict or `null`.
 * @returns `Accept`, `Reject` or `—`.
 * @throws Never throws.
 */
export function verdictLabel(v: Verdict | null): string {
  return word(v)
}

/**
 * The single-string result as CSV: the input, both verdicts, then one row
 * per step with the ε-NFA set and the DFA state.
 *
 * @param input - The raw input.
 * @param check - From {@link checkInput}.
 * @param trace - From {@link buildTrace}, or `null` when the input is invalid.
 * @param alphabet - Σ, for display.
 * @returns CSV text.
 * @throws Never throws.
 */
export function singleRunCSV(input: string, check: InputCheck, trace: RunTrace | null, alphabet: readonly string[]): string {
  if (!check.ok || !trace) {
    return rowsToCSV([
      ['Input', input],
      ['Result', 'Invalid input'],
      ['Note', check.ok ? '' : check.message],
    ])
  }
  const rows: string[][] = [
    ['Input', showString(trace.tokens, alphabet)],
    ['ε-NFA', trace.nfaAccepted ? 'Accepted' : 'Rejected'],
    ['DFA', trace.dfaAccepted ? 'Accepted' : 'Rejected'],
    ['Agree', trace.agree ? 'yes' : 'no'],
    [],
    ['Step', 'Symbol', 'Consumed', 'ε-NFA move', 'ε-NFA set (after ε-closure)', 'DFA state'],
    ['0', '', 'ε', '', formatSet(trace.nfa.initial), trace.dfa.path[0]],
  ]
  for (const s of trace.steps) {
    rows.push([
      String(s.index),
      s.symbol,
      showString(trace.tokens.slice(0, s.index), alphabet),
      formatSet(s.nfaMoved),
      formatSet(s.nfaAfter),
      s.dfaTo ?? (s.dfaFrom === null ? '' : '— (no move)'),
    ])
  }
  return rowsToCSV(rows)
}

/**
 * The equivalence check's sentence.
 *
 * @param r - From `checkEquivalence(nfa, dfa, maxLen)`.
 * @param maxLen - The length bound used.
 * @param alphabet - Σ, for display.
 * @returns `ok` and the sentence: "ε-NFA and DFA agree on all N strings over Σ up to length L", the
 *   capped variant, or the first counterexample.
 * @throws Never throws.
 */
export function equivalenceMessage(r: EquivalenceResult, maxLen: number, alphabet: readonly string[]): { ok: boolean; text: string } {
  const n = r.tested.toLocaleString('en-US')
  if (r.agree && r.exhaustive) return { ok: true, text: `ε-NFA and DFA agree on all ${n} strings over Σ up to length ${maxLen}.` }
  if (r.agree) return { ok: true, text: `ε-NFA and DFA agree on the first ${n} strings over Σ (the check stops there; not every string up to length ${maxLen} was tried).` }
  const c = r.counterexample!
  const s = showString(c.tokens, alphabet)
  return {
    ok: false,
    text: `Counterexample “${s}”: the ε-NFA ${c.acceptedByA ? 'accepts' : 'rejects'} it but the DFA ${c.acceptedByB ? 'accepts' : 'rejects'} it.`,
  }
}
