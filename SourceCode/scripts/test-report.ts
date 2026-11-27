/**
 * Runs every preset's expected strings and every validation case, then writes
 * the results to ../TestCases/results.csv and ../TestCases/results.md, and each
 * preset to ../TestCases/presets/<id>.json.
 *
 * Usage (from SourceCode/): npm run test:report
 * Exits with code 1 if any case fails.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toJSON, validateENFA } from '../src/core/automaton'
import { minimizeDFA } from '../src/core/minimize'
import { checkEquivalence } from '../src/core/equivalence'
import { InputSymbolError, simulateDFA, simulateENFA, tokenize } from '../src/core/simulate'
import { subsetConstruction } from '../src/core/subset'
import { presets } from '../src/presets'
import { dfaTableRows, formatDfaRows } from '../src/presets/compare'
import { validationCases } from '../src/presets/validation'

interface Row {
  id: string
  feature: string
  machine: string
  input: string
  expected: string
  actual: string
  status: 'PASS' | 'FAIL'
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../TestCases')
const rows: Row[] = []

function add(id: string, feature: string, machine: string, input: string, expected: string, actual: string): void {
  rows.push({ id, feature, machine, input, expected, actual, status: expected === actual ? 'PASS' : 'FAIL' })
}

const verdict = (b: boolean) => (b ? 'Accept' : 'Reject')

presets.forEach((p, pi) => {
  const prefix = `P${String(pi + 1).padStart(2, '0')}`
  let n = 0
  const nextId = () => `${prefix}-${String(++n).padStart(2, '0')}`

  const { dfa } = subsetConstruction(p.nfa)
  const min = minimizeDFA(dfa).dfa

  if (p.expectedDfaStates !== undefined) {
    add(nextId(), 'Subset construction: DFA state count', p.name, '-', String(p.expectedDfaStates), String(dfa.states.length))
  }
  if (p.expectedDfaTable) {
    add(
      nextId(),
      'Expected DFA table vs generated',
      p.name,
      '-',
      formatDfaRows(p.expectedDfaTable, p.nfa.alphabet),
      formatDfaRows(dfaTableRows(dfa), dfa.alphabet),
    )
  }
  if (p.expectedMinStates !== undefined) {
    add(nextId(), 'Expected minimal states vs generated', p.name, '-', String(p.expectedMinStates), String(min.states.length))
  }
  add(nextId(), 'Minimisation: no more states than DFA', p.name, '-', 'true', String(min.states.length <= dfa.states.length))
  const eqDfa = checkEquivalence(p.nfa, dfa, 8)
  const eqMin = checkEquivalence(dfa, min, 8)
  const eqText = (r: ReturnType<typeof checkEquivalence>) =>
    r.agree ? `agree on all ${r.tested} strings` : `differ on "${r.counterexample?.input === '' ? 'ε' : r.counterexample?.input}"`
  // Number of strings of length 0..8 over Σ, worked out independently of the check.
  const allStrings = Array.from({ length: 9 }, (_, k) => p.nfa.alphabet.length ** k).reduce((x, y) => x + y, 0)
  add(
    nextId(),
    'checkEquivalence: ε-NFA ≡ DFA ≡ min-DFA (length ≤ 8)',
    p.name,
    'all strings ≤ 8',
    `ε-NFA ≡ DFA: agree on all ${allStrings} strings; DFA ≡ min-DFA: agree on all ${allStrings} strings`,
    `ε-NFA ≡ DFA: ${eqText(eqDfa)}; DFA ≡ min-DFA: ${eqText(eqMin)}`,
  )

  const cases = [...p.expected.accepts.map((s) => [s, true] as const), ...p.expected.rejects.map((s) => [s, false] as const)]
  for (const [input, want] of cases) {
    const tokens = tokenize(input, p.nfa.alphabet)
    const shown = input === '' ? 'ε' : input
    add(nextId(), 'ε-NFA simulation', p.name, shown, verdict(want), verdict(simulateENFA(p.nfa, tokens).accepted))
    add(nextId(), 'DFA simulation', p.name, shown, verdict(want), verdict(simulateDFA(dfa, tokens).accepted))
    add(nextId(), 'Minimal DFA simulation', p.name, shown, verdict(want), verdict(simulateDFA(min, tokens).accepted))
  }

  // Expected rejection of input outside Σ: an accepted string with a stray symbol appended.
  const stray = ['z', '#', '2', '!'].find((c) => !p.nfa.alphabet.some((a) => a.includes(c)))!
  const bad = `${p.expected.accepts[0] ?? ''}${stray}`
  // Shown 1-based: the stray symbol comes after every symbol of the accepted string.
  const symbolNumber = tokenize(bad.slice(0, bad.indexOf(stray)), p.nfa.alphabet).length + 1
  let got: string
  try {
    tokenize(bad, p.nfa.alphabet)
    got = 'no error'
  } catch (e) {
    got = e instanceof InputSymbolError ? `InputSymbolError "${e.character}" (symbol ${tokenize(bad.slice(0, e.position), p.nfa.alphabet).length + 1})` : String(e)
  }
  add(nextId(), 'Invalid symbol → InputSymbolError', p.name, bad, `InputSymbolError "${stray}" (symbol ${symbolNumber})`, got)
})

validationCases.forEach((c, i) => {
  const { errors, warnings } = validateENFA(c.nfa)
  const found = (c.severity === 'error' ? errors : warnings).some((x) => x.code === c.code)
  add(
    `V${String(i + 1).padStart(2, '0')}`,
    `Validation (${c.severity})`,
    c.description,
    c.code,
    `${c.code} reported`,
    found ? `${c.code} reported` : `not reported`,
  )
})

const header = ['ID', 'Feature', 'Machine', 'Input', 'Expected', 'Actual', 'Status']
const fields = (r: Row) => [r.id, r.feature, r.machine, r.input, r.expected, r.actual, r.status]

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const csv = [header, ...rows.map(fields)].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'

const mdCell = (s: string) => s.replace(/\|/g, '\\|')
const passed = rows.filter((r) => r.status === 'PASS').length
const md =
  [
    '# Test results',
    '',
    `Generated by \`npm run test:report\`. ${passed} of ${rows.length} cases passed.`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${fields(r).map(mdCell).join(' | ')} |`),
  ].join('\n') + '\n'

mkdirSync(join(outDir, 'presets'), { recursive: true })
// The BOM makes Excel read the file as UTF-8, so ε and ∅ display correctly.
writeFileSync(join(outDir, 'results.csv'), '﻿' + csv)
writeFileSync(join(outDir, 'results.md'), md)
for (const p of presets) {
  const file = {
    id: p.id,
    name: p.name,
    description: p.description,
    ...JSON.parse(toJSON(p.nfa)),
    expected: p.expected,
    ...(p.expectedDfaStates !== undefined ? { expectedDfaStates: p.expectedDfaStates } : {}),
    ...(p.expectedDfaTable ? { expectedDfaTable: p.expectedDfaTable } : {}),
    ...(p.expectedMinStates !== undefined ? { expectedMinStates: p.expectedMinStates } : {}),
  }
  writeFileSync(join(outDir, 'presets', `${p.id}.json`), JSON.stringify(file, null, 2) + '\n')
}

console.log(`${passed}/${rows.length} cases passed. Wrote ${outDir}`)
if (passed !== rows.length) {
  for (const r of rows.filter((x) => x.status === 'FAIL')) console.error(`FAIL ${r.id}: ${r.machine} ${r.input}`)
  process.exit(1)
}
