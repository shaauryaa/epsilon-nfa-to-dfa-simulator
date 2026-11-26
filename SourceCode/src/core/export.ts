/**
 * Export formats for converted DFAs: JFLAP, JSON, plain text, Graphviz,
 * CSV and ready-to-run Python / JavaScript, plus a plain-text step log.
 *
 * Every function here is pure: it takes plain data and returns a string, so
 * the UI only has to turn the string into a file.
 */

import { toJSON, toText } from './automaton'
import { formatSet } from './sets'
import type { SubsetResult } from './subset'
import { EPSILON, type DFA, type ENFA } from './types'

/** A position in diagram coordinates (top-left of a state). */
export interface Point {
  x: number
  y: number
}

/** Thrown by {@link parseJFLAP} when the XML is not a JFLAP finite automaton. */
export class JFLAPError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JFLAPError'
  }
}

/**
 * Rewrites a DFA as an ε-NFA with no ε-moves, so the app's own text and JSON
 * formats (and editor) can hold it.
 *
 * @param dfa - The DFA. Partial DFAs are fine: missing moves stay missing.
 * @returns An ENFA with the same states, alphabet, start and finals, and
 *   every transition as a one-element target list.
 * @throws Never throws.
 */
export function dfaToENFA(dfa: DFA): ENFA {
  const transitions: ENFA['transitions'] = {}
  for (const s of dfa.states) {
    const row = dfa.transitions[s] ?? {}
    const out: Record<string, string[]> = {}
    for (const a of dfa.alphabet) if (row[a] !== undefined) out[a] = [row[a]]
    if (Object.keys(out).length > 0) transitions[s] = out
  }
  return { states: [...dfa.states], alphabet: [...dfa.alphabet], start: dfa.start, finals: [...dfa.finals], transitions }
}

/**
 * Serialises a DFA in the app's JSON format, which the Import button reads
 * back as a machine (an ε-NFA that happens to have no ε-moves).
 *
 * @param dfa - The DFA.
 * @returns JSON text ending with a newline.
 * @throws Never throws.
 */
export function dfaToJSON(dfa: DFA): string {
  return toJSON(dfaToENFA(dfa)) + '\n'
}

/**
 * Prints a DFA in the Define tab's plain-text format, so it can be pasted
 * back into the text editor.
 *
 * @param dfa - The DFA.
 * @returns The text, ending with a newline.
 * @throws Never throws.
 */
export function dfaToText(dfa: DFA): string {
  return toText(dfaToENFA(dfa))
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

/**
 * Writes a DFA as a JFLAP 7 finite-automaton file (`.jff`).
 *
 * JFLAP identifies states by integer id and shows `name`; ids follow the
 * DFA's state order. Positions are written in JFLAP's pixel coordinates
 * (state centres); states without a position are placed on a grid.
 *
 * @param dfa - The DFA.
 * @param positions - Optional top-left positions keyed by state name, for
 *   example from the app's layout.
 * @param nodeSize - Diameter used to turn top-left positions into centres.
 * @returns The XML document.
 * @throws Never throws.
 */
export function dfaToJFLAP(dfa: DFA, positions: Record<string, Point> = {}, nodeSize = 56): string {
  const id = new Map(dfa.states.map((s, i) => [s, i]))
  const finals = new Set(dfa.finals)
  const lines = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!--Exported from the epsilon-NFA to DFA simulator.-->',
    '<structure>',
    '\t<type>fa</type>',
    '\t<automaton>',
  ]
  dfa.states.forEach((s, i) => {
    const p = positions[s]
    const x = p ? p.x + nodeSize / 2 + 60 : 100 + (i % 6) * 120
    const y = p ? p.y + nodeSize / 2 + 60 : 100 + Math.floor(i / 6) * 120
    lines.push(`\t\t<state id="${i}" name="${xmlEscape(s)}">`)
    lines.push(`\t\t\t<x>${x.toFixed(1)}</x>`)
    lines.push(`\t\t\t<y>${y.toFixed(1)}</y>`)
    if (s === dfa.start) lines.push('\t\t\t<initial/>')
    if (finals.has(s)) lines.push('\t\t\t<final/>')
    lines.push('\t\t</state>')
  })
  for (const s of dfa.states) {
    for (const a of dfa.alphabet) {
      const t = dfa.transitions[s]?.[a]
      if (t === undefined || !id.has(t)) continue
      lines.push('\t\t<transition>')
      lines.push(`\t\t\t<from>${id.get(s)}</from>`)
      lines.push(`\t\t\t<to>${id.get(t)}</to>`)
      lines.push(`\t\t\t<read>${xmlEscape(a)}</read>`)
      lines.push('\t\t</transition>')
    }
  }
  lines.push('\t</automaton>', '</structure>', '')
  return lines.join('\n')
}

/** Result of {@link parseJFLAP}. */
export interface JFLAPMachine {
  /** The machine; an empty `<read/>` becomes ε. */
  nfa: ENFA
  /** State centres as written in the file, keyed by state name. */
  positions: Record<string, Point>
}

const tag = (body: string, name: string): string | null => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body)
  return m ? xmlUnescape(m[1].trim()) : null
}

/**
 * Reads a JFLAP finite-automaton file (`.jff`) written by JFLAP or by
 * {@link dfaToJFLAP}.
 *
 * The parser is a small, tolerant tag reader (no DOM needed): it reads every
 * `<state>` and `<transition>` inside `<automaton>`. State names fall back to
 * `q<id>` when `name` is missing. The alphabet is every non-empty `<read>`
 * symbol in order of first use.
 *
 * @param xml - The file contents.
 * @returns The machine and its state positions.
 * @throws {JFLAPError} If the type is not `fa`, there is no `<automaton>`,
 *   a transition refers to an unknown state id, or there is not exactly one
 *   initial state.
 */
export function parseJFLAP(xml: string): JFLAPMachine {
  const type = tag(xml, 'type')
  if (type !== 'fa') throw new JFLAPError(`Expected a finite automaton (type "fa"), found ${type === null ? 'no type' : `"${type}"`}.`)
  const auto = /<automaton>([\s\S]*?)<\/automaton>/.exec(xml)
  if (!auto) throw new JFLAPError('No <automaton> element.')
  const body = auto[1]

  const names = new Map<string, string>()
  const nfa: ENFA = { states: [], alphabet: [], start: '', finals: [], transitions: {} }
  const positions: Record<string, Point> = {}
  const starts: string[] = []
  const stateRe = /<state\b([^>]*?)(?:\/>|>([\s\S]*?)<\/state>)/g
  for (let m = stateRe.exec(body); m; m = stateRe.exec(body)) {
    const attrs = m[1]
    const inner = m[2] ?? ''
    const id = /\bid="([^"]*)"/.exec(attrs)?.[1]
    if (id === undefined) throw new JFLAPError('A <state> has no id.')
    const name = xmlUnescape(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? `q${id}`)
    names.set(id, name)
    nfa.states.push(name)
    const x = tag(inner, 'x')
    const y = tag(inner, 'y')
    if (x !== null && y !== null) positions[name] = { x: Number(x), y: Number(y) }
    if (/<initial\s*\/>|<initial>/.test(inner)) starts.push(name)
    if (/<final\s*\/>|<final>/.test(inner)) nfa.finals.push(name)
  }
  if (starts.length !== 1) throw new JFLAPError(`Expected exactly one initial state, found ${starts.length}.`)
  nfa.start = starts[0]

  const transRe = /<transition>([\s\S]*?)<\/transition>/g
  for (let m = transRe.exec(body); m; m = transRe.exec(body)) {
    const inner = m[1]
    const from = names.get(tag(inner, 'from') ?? '')
    const to = names.get(tag(inner, 'to') ?? '')
    if (from === undefined || to === undefined) throw new JFLAPError('A <transition> refers to an unknown state.')
    const read = tag(inner, 'read') ?? ''
    const sym = read === '' ? EPSILON : read
    if (sym !== EPSILON && !nfa.alphabet.includes(sym)) nfa.alphabet.push(sym)
    const row = (nfa.transitions[from] ??= {})
    const list = (row[sym] ??= [])
    if (!list.includes(to)) list.push(to)
  }
  return { nfa, positions }
}

const dotId = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * Writes a DFA in Graphviz DOT, left to right, with double circles for final
 * states and an invisible point pointing at the start state. Parallel edges
 * between the same two states are merged into one comma-separated label.
 *
 * @param dfa - The DFA.
 * @param name - Graph name (used in the `digraph` line).
 * @returns The DOT source.
 * @throws Never throws.
 */
export function dfaToDot(dfa: DFA, name = 'DFA'): string {
  const finals = new Set(dfa.finals)
  const lines = [`digraph ${dotId(name)} {`, '  rankdir=LR;', '  node [shape=circle, fontname="Helvetica"];', '  __start [shape=point, label=""];']
  for (const s of dfa.states) {
    const subset = dfa.subsets[s]
    const label = subset ? `${s}\\n${formatSet(subset)}` : s
    lines.push(`  ${dotId(s)} [${finals.has(s) ? 'shape=doublecircle, ' : ''}label="${label.replace(/"/g, '\\"')}"];`)
  }
  lines.push(`  __start -> ${dotId(dfa.start)};`)
  for (const s of dfa.states) {
    const byTarget = new Map<string, string[]>()
    for (const a of dfa.alphabet) {
      const t = dfa.transitions[s]?.[a]
      if (t !== undefined) byTarget.set(t, [...(byTarget.get(t) ?? []), a])
    }
    for (const [t, syms] of byTarget) lines.push(`  ${dotId(s)} -> ${dotId(t)} [label="${syms.join(', ').replace(/"/g, '\\"')}"];`)
  }
  lines.push('}', '')
  return lines.join('\n')
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Writes the DFA transition table as CSV (RFC 4180): one row per state with
 * its subset of NFA states, start/final flags and one column per symbol. A
 * missing move (partial DFA) is an empty cell.
 *
 * @param dfa - The DFA.
 * @returns CSV text with CRLF line endings, as spreadsheet programs expect.
 * @throws Never throws.
 */
export function dfaToCSV(dfa: DFA): string {
  const finals = new Set(dfa.finals)
  const rows = [['State', 'NFA states', 'Start', 'Final', ...dfa.alphabet]]
  for (const s of dfa.states) {
    rows.push([
      s,
      formatSet(dfa.subsets[s] ?? []),
      s === dfa.start ? 'yes' : '',
      finals.has(s) ? 'yes' : '',
      ...dfa.alphabet.map((a) => dfa.transitions[s]?.[a] ?? ''),
    ])
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/**
 * Runs a DFA on a token sequence.
 *
 * @param dfa - The DFA; a missing move rejects.
 * @param tokens - Input symbols.
 * @returns Whether the DFA ends in a final state.
 * @throws Never throws.
 */
function runDFA(dfa: DFA, tokens: readonly string[]): boolean {
  let s: string | undefined = dfa.start
  for (const t of tokens) {
    s = dfa.transitions[s]?.[t]
    if (s === undefined) return false
  }
  return dfa.finals.includes(s)
}

/** One example input for generated code: the raw string and whether the DFA accepts it. */
export interface CodeExample {
  input: string
  accepted: boolean
}

/**
 * Picks short example inputs for generated code: up to three accepted and
 * two rejected strings, found by trying all strings in length order (up to
 * length 6 or 4000 strings).
 *
 * @param dfa - The DFA.
 * @returns The examples, accepted ones first.
 * @throws Never throws.
 */
export function codeExamples(dfa: DFA): CodeExample[] {
  const yes: CodeExample[] = []
  const no: CodeExample[] = []
  let frontier: string[][] = [[]]
  let tried = 0
  for (let len = 0; len <= 6 && (yes.length < 3 || no.length < 2) && tried < 4000; len++) {
    const next: string[][] = []
    for (const w of frontier) {
      tried++
      const ex = { input: w.join(''), accepted: runDFA(dfa, w) }
      if (ex.accepted && yes.length < 3) yes.push(ex)
      if (!ex.accepted && no.length < 2) no.push(ex)
      for (const a of dfa.alphabet) next.push([...w, a])
    }
    frontier = next
  }
  return [...yes, ...no]
}

const jsString = (s: string) => JSON.stringify(s)
const pyString = (s: string) => JSON.stringify(s)

/**
 * Generates a small, dependency-free Python module implementing the DFA as a
 * transition dictionary, with an `accepts(string) -> bool` function, a
 * docstring and example calls. Multi-character symbols are matched greedily
 * (longest first), like the app does.
 *
 * @param dfa - The DFA.
 * @param name - Machine name for the docstring.
 * @returns Python 3 source.
 * @throws Never throws.
 */
export function dfaToPython(dfa: DFA, name = 'DFA'): string {
  const rows = dfa.states.map((s) => {
    const cells = dfa.alphabet
      .filter((a) => dfa.transitions[s]?.[a] !== undefined)
      .map((a) => `${pyString(a)}: ${pyString(dfa.transitions[s][a])}`)
    return `    ${pyString(s)}: {${cells.join(', ')}},`
  })
  const examples = codeExamples(dfa)
  return [
    `"""DFA for ${name.replace(/"/g, "'")}, converted from an epsilon-NFA by subset construction.`,
    '',
    'Call accepts(text) to test a string. A missing move in TRANSITIONS means',
    'the string is rejected.',
    '"""',
    '',
    `START = ${pyString(dfa.start)}`,
    `FINALS = {${dfa.finals.map(pyString).join(', ')}}`,
    `ALPHABET = [${dfa.alphabet.map(pyString).join(', ')}]`,
    'TRANSITIONS = {',
    ...rows,
    '}',
    '',
    '',
    'def accepts(text: str) -> bool:',
    '    """Return True if the DFA accepts text.',
    '',
    '    Symbols are read left to right, longest symbol first; whitespace is',
    '    ignored. A character that starts no symbol rejects the string.',
    '    """',
    '    symbols = sorted(ALPHABET, key=len, reverse=True)',
    '    state = START',
    '    i = 0',
    '    while i < len(text):',
    '        if text[i].isspace():',
    '            i += 1',
    '            continue',
    '        symbol = next((s for s in symbols if text.startswith(s, i)), None)',
    '        if symbol is None:',
    '            return False',
    '        state = TRANSITIONS.get(state, {}).get(symbol)',
    '        if state is None:',
    '            return False',
    '        i += len(symbol)',
    '    return state in FINALS',
    '',
    '',
    'if __name__ == "__main__":',
    ...examples.map((e) => `    print(${pyString(e.input)}, accepts(${pyString(e.input)}))  # ${e.accepted ? 'True' : 'False'}`),
    '',
  ].join('\n')
}

/**
 * Generates a small, dependency-free JavaScript (ES module) file
 * implementing the DFA as a transition object, with an `accepts(string)`
 * function, a doc comment and example calls. Multi-character symbols are
 * matched greedily (longest first), like the app does.
 *
 * @param dfa - The DFA.
 * @param name - Machine name for the doc comment.
 * @returns JavaScript source that runs in Node or a browser.
 * @throws Never throws.
 */
export function dfaToJavaScript(dfa: DFA, name = 'DFA'): string {
  const rows = dfa.states.map((s) => {
    const cells = dfa.alphabet
      .filter((a) => dfa.transitions[s]?.[a] !== undefined)
      .map((a) => `${jsString(a)}: ${jsString(dfa.transitions[s][a])}`)
    return `  ${jsString(s)}: { ${cells.join(', ')} },`
  })
  const examples = codeExamples(dfa)
  return [
    `// DFA for ${name.replace(/\n/g, ' ')}, converted from an epsilon-NFA by subset construction.`,
    '',
    `const START = ${jsString(dfa.start)}`,
    `const FINALS = new Set([${dfa.finals.map(jsString).join(', ')}])`,
    `const ALPHABET = [${dfa.alphabet.map(jsString).join(', ')}]`,
    'const TRANSITIONS = {',
    ...rows,
    '}',
    '',
    '/**',
    ' * Returns true if the DFA accepts `text`.',
    ' * Symbols are read left to right, longest symbol first; whitespace is',
    ' * ignored. A missing move, or a character that starts no symbol, rejects.',
    ' * @param {string} text',
    ' * @returns {boolean}',
    ' */',
    'export function accepts(text) {',
    '  const symbols = [...ALPHABET].sort((a, b) => b.length - a.length)',
    '  let state = START',
    '  let i = 0',
    '  while (i < text.length) {',
    '    if (/\\s/.test(text[i])) {',
    '      i++',
    '      continue',
    '    }',
    '    const symbol = symbols.find((s) => text.startsWith(s, i))',
    '    if (symbol === undefined) return false',
    '    state = TRANSITIONS[state]?.[symbol]',
    '    if (state === undefined) return false',
    '    i += symbol.length',
    '  }',
    '  return FINALS.has(state)',
    '}',
    '',
    ...examples.map((e) => `console.log(${jsString(e.input)}, accepts(${jsString(e.input)})) // ${e.accepted}`),
    '',
  ].join('\n')
}

/**
 * Writes the subset construction as a plain-text log: the ε-NFA's start
 * closure, one numbered line per step, and the resulting DFA's state
 * mapping.
 *
 * @param nfa - The ε-NFA that was converted.
 * @param result - The output of `subsetConstruction`.
 * @param name - Machine name for the heading.
 * @returns The log text, ending with a newline.
 * @throws Never throws.
 */
export function stepLogText(nfa: ENFA, result: SubsetResult, name = 'ε-NFA'): string {
  const { dfa, steps, stats } = result
  const out = [
    `Subset construction for ${name}`,
    `ε-NFA: ${nfa.states.length} states, Σ = {${nfa.alphabet.join(', ')}}, start ${nfa.start}, finals ${formatSet(nfa.finals)}`,
    '',
    'Steps',
    ...steps.map((s) => `${String(s.index + 1).padStart(3)}. ${s.explanation}`),
    '',
    'DFA states',
    ...dfa.states.map(
      (s) => `  ${s} = ${formatSet(dfa.subsets[s] ?? [])}${s === dfa.start ? '  (start)' : ''}${dfa.finals.includes(s) ? '  (final)' : ''}`,
    ),
    '',
    `${stats.dfaStates} DFA states from ${stats.nfaStates} NFA states (bound 2^${stats.nfaStates} = ${stats.upperBound}).`,
    '',
  ]
  return out.join('\n')
}

/**
 * Builds a download file name from a machine name, a label and a time:
 * `thompson-abb-dfa-20261127-0412.jff`.
 *
 * @param machine - Machine name; anything other than letters, digits, `-`
 *   and `_` becomes `-`. Empty names become `machine`.
 * @param label - What the file holds, e.g. `dfa` or `report`.
 * @param ext - Extension without the dot.
 * @param when - Time stamp (local time).
 * @returns The file name.
 * @throws Never throws.
 */
export function exportFileName(machine: string, label: string, ext: string, when: Date): string {
  const slug =
    machine
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'machine'
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${when.getFullYear()}${p(when.getMonth() + 1)}${p(when.getDate())}-${p(when.getHours())}${p(when.getMinutes())}`
  return `${slug}-${label}-${stamp}.${ext}`
}
