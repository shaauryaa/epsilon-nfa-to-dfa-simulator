/**
 * Builds the "full report" PDF: the input ε-NFA (5-tuple, table, diagram),
 * the ε-closure table, every subset-construction step, the DFA table and
 * diagram, the subset-to-name mapping and a minimisation summary. jsPDF, the
 * table plugin and the Unicode font are loaded only when a report is
 * requested.
 */

import { EPSILON, formatSet, type ENFA, type MinimizeResult, type SubsetResult } from '../core'
import { deadStateNote, minimisationSummary } from '../model/reportText'
import { statusLabel, verdictLabel, type BatchRow } from '../model/testRun'
import type { Diagram } from '../model/svg'
import { blobToDataURL, svgToPng } from './download'

/** Everything the report shows. */
export interface ReportInput {
  name: string
  nfa: ENFA
  closures: Record<string, string[]>
  result: SubsetResult
  /** Minimisation of `result.dfa`. */
  minimized: MinimizeResult
  /** Whether the "Show dead state ∅" switch was on. */
  showDead: boolean
  nfaDiagram: Diagram
  /** `null` when the DFA is too large to draw. */
  dfaDiagram: Diagram | null
  when: Date
  /** Results from the Test tab; the section is left out when `null`. */
  tests?: ReportTests | null
}

/** The report's "Test strings" section. */
export interface ReportTests {
  /** The string in the Test tab's input box. */
  single:
    | { input: string; nfaAccepted: boolean; dfaAccepted: boolean; nfaTrace: string; dfaTrace: string }
    | { input: string; invalid: string }
    | null
  /** The batch table; `fromPreset` when it is the preset's expected strings (no batch was run). */
  batch: { rows: BatchRow[]; summary: string; fromPreset: boolean } | null
  equivalence: { ok: boolean; text: string } | null
}

/** Longest table printed in full; larger DFAs print this many rows and point to the CSV download. */
const MAX_TABLE_ROWS = 200

async function fontBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/**
 * Renders the report.
 *
 * @param input - See {@link ReportInput}.
 * @returns The PDF as a blob.
 * @throws If a library, the font or a diagram fails to load.
 */
export async function buildReport(input: ReportInput): Promise<Blob> {
  const [{ jsPDF }, { autoTable }, regularUrl, boldUrl] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url').then((m) => m.default as string),
    import('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url').then((m) => m.default as string),
  ])
  const [regular, bold, nfaPng, dfaPng] = await Promise.all([
    fontBase64(regularUrl),
    fontBase64(boldUrl),
    svgToPng(input.nfaDiagram.svg, input.nfaDiagram.width, input.nfaDiagram.height).then(blobToDataURL),
    input.dfaDiagram ? svgToPng(input.dfaDiagram.svg, input.dfaDiagram.width, input.dfaDiagram.height).then(blobToDataURL) : Promise.resolve(null),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  doc.addFileToVFS('DejaVuSans.ttf', regular)
  doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold)
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold')
  doc.setFont('DejaVu', 'normal')

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 48
  let y = M

  const ensure = (h: number) => {
    if (y + h > pageH - M) {
      doc.addPage()
      y = M
    }
  }
  const heading = (text: string) => {
    ensure(40)
    doc.setFont('DejaVu', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(15, 23, 42)
    doc.text(text, M, y)
    y += 20
    doc.setFont('DejaVu', 'normal')
  }
  const para = (text: string, size = 10) => {
    doc.setFontSize(size)
    doc.setTextColor(51, 65, 85)
    const lines = doc.splitTextToSize(text, pageW - 2 * M) as string[]
    ensure(lines.length * size * 1.4)
    doc.text(lines, M, y)
    y += lines.length * size * 1.4 + 6
  }
  const table = (head: string[], body: string[][]) => {
    autoTable(doc, {
      head: [head],
      body,
      startY: y,
      margin: { left: M, right: M },
      styles: { font: 'DejaVu', fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
      headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] },
      theme: 'grid',
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 18
  }
  const image = (dataUrl: string, d: Diagram) => {
    const maxW = pageW - 2 * M
    const maxH = pageH - 2 * M - 20
    const scale = Math.min(maxW / d.width, maxH / d.height, 1)
    const w = d.width * scale
    const h = d.height * scale
    ensure(h + 10)
    doc.addImage(dataUrl, 'PNG', M, y, w, h)
    y += h + 18
  }

  const { nfa, result, closures } = input
  const { dfa, steps, stats } = result
  const syms = [...nfa.alphabet, EPSILON]

  doc.setFont('DejaVu', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(15, 23, 42)
  doc.text('ε-NFA → DFA conversion report', M, y)
  y += 22
  para(`Machine: ${input.name} · Generated ${input.when.toLocaleString()}`, 10)
  y += 6

  heading('1. Input ε-NFA')
  para(
    [
      `Q = ${formatSet(nfa.states)}`,
      `Σ = {${nfa.alphabet.join(', ')}}`,
      `q0 = ${nfa.start}`,
      `F = ${formatSet(nfa.finals)}`,
      'δ is given by the transition table below (ε-moves in the last column).',
    ].join('\n'),
    10,
  )
  table(
    ['State', ...syms],
    nfa.states.map((s) => [
      `${s === nfa.start ? '→ ' : ''}${nfa.finals.includes(s) ? '* ' : ''}${s}`,
      ...syms.map((a) => {
        const t = nfa.transitions[s]?.[a]
        return t && t.length > 0 ? formatSet(t) : '∅'
      }),
    ]),
  )
  image(nfaPng, input.nfaDiagram)

  heading('2. ε-closures')
  table(
    ['State', 'ε-closure'],
    nfa.states.map((s) => [s, formatSet(closures[s] ?? [])]),
  )

  const bigSteps = steps.length > MAX_TABLE_ROWS
  heading('3. Subset construction steps')
  if (bigSteps) para(`${steps.length.toLocaleString()} steps; the first ${MAX_TABLE_ROWS} are listed. Download the step log for all of them.`)
  table(
    ['#', 'From', 'Symbol', 'move', 'ε-closure', 'To'],
    steps.slice(0, MAX_TABLE_ROWS).map((s) => [
      String(s.index + 1),
      s.kind === 'start' ? 'start' : s.kind === 'done' ? 'done' : `${s.from} = ${formatSet(s.fromSet ?? [])}`,
      s.symbol ?? '',
      s.moveSet ? formatSet(s.moveSet) : s.kind === 'start' ? `{${nfa.start}}` : '',
      s.kind === 'done' ? '' : formatSet(s.closureSet),
      s.to === null ? (s.kind === 'done' ? '' : '— (none)') : `${s.to}${s.isNew ? ' (new)' : ''}`,
    ]),
  )
  if (!bigSteps) for (const s of steps) para(`${s.index + 1}. ${s.explanation}`, 9)
  y += 6

  heading('4. Resulting DFA')
  para(
    `${stats.dfaStates} DFA states from ${stats.nfaStates} NFA states (bound 2^${stats.nfaStates} = ${stats.upperBound}). Start ${dfa.start}; final ${
      dfa.finals.length > 0 ? dfa.finals.join(', ') : 'none'
    }. ${deadStateNote(dfa, input.showDead)}`,
  )
  const bigDfa = dfa.states.length > MAX_TABLE_ROWS
  if (bigDfa) para(`The first ${MAX_TABLE_ROWS} of ${dfa.states.length.toLocaleString()} states are listed; the CSV download has the whole table.`)
  table(
    ['State', ...dfa.alphabet],
    dfa.states.slice(0, MAX_TABLE_ROWS).map((s) => [
      `${s === dfa.start ? '→ ' : ''}${dfa.finals.includes(s) ? '* ' : ''}${s}`,
      ...dfa.alphabet.map((a) => dfa.transitions[s]?.[a] ?? '—'),
    ]),
  )
  if (dfaPng && input.dfaDiagram) image(dfaPng, input.dfaDiagram)
  else para('The DFA has too many states to draw clearly, so its diagram is left out.')

  heading('5. Subset-to-name mapping')
  table(
    ['DFA state', 'NFA states', 'Role'],
    dfa.states.slice(0, MAX_TABLE_ROWS).map((s) => [
      s,
      formatSet(dfa.subsets[s] ?? []),
      [s === dfa.start ? 'start' : '', dfa.finals.includes(s) ? 'final' : '', s === dfa.deadState ? 'dead' : ''].filter(Boolean).join(', '),
    ]),
  )

  heading('6. Minimisation')
  const summary = minimisationSummary(dfa, input.minimized)
  para(summary.text)
  if (summary.removed.length > 0) para(`Unreachable states removed first: ${summary.removed.join(', ')}.`)
  if (summary.merged.length > 0) {
    table(['Merged group', 'New state'], summary.merged.slice(0, MAX_TABLE_ROWS).map((line) => line.split(' → ')))
  } else {
    para('No states were merged.')
  }
  const min = input.minimized.dfa
  para(`Minimal DFA: ${min.states.length} state${min.states.length === 1 ? '' : 's'}, start ${min.start}, final ${min.finals.length > 0 ? min.finals.join(', ') : 'none'}.`)

  const tests = input.tests
  if (tests) {
    heading('7. Test strings')
    const t = tests.single
    if (t && 'invalid' in t) {
      para(`Input “${t.input}”: ${t.invalid} It is an invalid input, not a rejection.`)
    } else if (t) {
      para(`Input ${t.input === 'ε' ? 'ε (the empty string)' : `“${t.input}”`}: the ε-NFA ${t.nfaAccepted ? 'accepts' : 'rejects'} it and the DFA ${t.dfaAccepted ? 'accepts' : 'rejects'} it${t.nfaAccepted === t.dfaAccepted ? ' (both machines agree)' : ' (the machines disagree)'}.`)
      para(`ε-NFA trace: ${t.nfaTrace}`, 9)
      para(`DFA trace: ${t.dfaTrace}`, 9)
    }
    if (tests.batch) {
      para(`${tests.batch.fromPreset ? 'The preset’s expected strings' : 'Batch test'}: ${tests.batch.summary}. PASS means the ε-NFA, the DFA and the minimal DFA give the same verdict, which also matches the expected one where it is known.`)
      table(
        ['#', 'String', 'Expected', 'ε-NFA', 'DFA', 'Min-DFA', 'Status'],
        tests.batch.rows.slice(0, MAX_TABLE_ROWS).map((r) => [String(r.index), r.display, verdictLabel(r.expected), verdictLabel(r.nfa), verdictLabel(r.dfa), verdictLabel(r.min), statusLabel(r.status)]),
      )
    }
    if (tests.equivalence) para(`Equivalence check: ${tests.equivalence.text}`)
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(`${input.name} · page ${i} of ${pages}`, pageW - M, pageH - 24, { align: 'right' })
  }
  return doc.output('blob')
}
