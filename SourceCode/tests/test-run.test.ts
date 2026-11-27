import { describe, expect, it } from 'vitest'
import { checkEquivalence, minimizeDFA, subsetConstruction, type DFA } from '../src/core'
import { planRun } from '../src/model/testPlan'
import {
  batchCSV,
  batchSummary,
  buildTrace,
  checkInput,
  dfaTraceCells,
  equivalenceMessage,
  expectedBatchText,
  expectedIndex,
  nfaTraceCells,
  parseBatch,
  runBatch,
  showString,
  singleRunCSV,
  traceText,
} from '../src/model/testRun'
import { getPreset, presets } from '../src/presets'
import { useTest } from '../src/store/test'

const abb = getPreset('thompson-abb')!
const nfa = abb.nfa
const dfa = subsetConstruction(nfa).dfa
const min = minimizeDFA(dfa).dfa
const machines = { nfa, dfa, min }

describe('checkInput', () => {
  it('splits a valid string into symbols', () => {
    expect(checkInput('abb', nfa.alphabet)).toEqual({ ok: true, tokens: ['a', 'b', 'b'] })
  })

  it('treats empty, blank and a lone ε as the empty string', () => {
    for (const s of ['', '   ', 'ε', ' ε ']) expect(checkInput(s, nfa.alphabet)).toEqual({ ok: true, tokens: [] })
  })

  it('reports an invalid symbol with its 0-based position instead of rejecting', () => {
    const c = checkInput('abcb', nfa.alphabet)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.symbol).toBe('c')
    expect(c.position).toBe(2)
    expect(c.message).toBe('“c” at position 2 is not in Σ = {a, b}.')
  })

  it('counts positions in characters, not UTF-16 units', () => {
    const c = checkInput('a😀b', nfa.alphabet)
    expect(c).toMatchObject({ ok: false, symbol: '😀', position: 1 })
    expect(checkInput('ab😀', nfa.alphabet)).toMatchObject({ ok: false, position: 2 })
  })

  it('works with multi-character symbols', () => {
    const p = getPreset('multi-char-symbols')!
    expect(checkInput('if x if x', p.nfa.alphabet)).toEqual({ ok: true, tokens: ['if', 'x', 'if', 'x'] })
    expect(checkInput('ify', p.nfa.alphabet)).toMatchObject({ ok: false, symbol: 'y', position: 2 })
  })
})

describe('buildTrace', () => {
  it('lines up the ε-NFA sets and the DFA path for (a|b)*abb on "abb"', () => {
    const t = buildTrace(nfa, dfa, ['a', 'b', 'b'])
    expect(t.nfa.initial).toEqual(['0', '1', '2', '4', '7'])
    expect(t.steps.map((s) => s.nfaAfter)).toEqual([
      ['1', '2', '3', '4', '6', '7', '8'],
      ['1', '2', '4', '5', '6', '7', '9'],
      ['1', '2', '4', '5', '6', '7', '10'],
    ])
    expect(t.dfa.path).toEqual(['A', 'B', 'D', 'E'])
    expect(t.steps.map((s) => [s.dfaFrom, s.symbol, s.dfaTo])).toEqual([
      ['A', 'a', 'B'],
      ['B', 'b', 'D'],
      ['D', 'b', 'E'],
    ])
    expect(t).toMatchObject({ nfaAccepted: true, dfaAccepted: true, agree: true, dfaStuckAt: null })
  })

  it('handles the empty string: no steps, verdict from the start set', () => {
    const t = buildTrace(nfa, dfa, [])
    expect(t.steps).toEqual([])
    expect(t).toMatchObject({ nfaAccepted: false, dfaAccepted: false, agree: true })
    expect(traceText(nfaTraceCells(t))).toBe('{0,1,2,4,7}')
    expect(traceText(dfaTraceCells(t))).toBe('A')
  })

  it('writes both traces as rows labelled with the symbols', () => {
    const t = buildTrace(nfa, dfa, ['a', 'b'])
    expect(traceText(nfaTraceCells(t))).toBe('{0,1,2,4,7} —a→ {1,2,3,4,6,7,8} —b→ {1,2,4,5,6,7,9}')
    expect(traceText(dfaTraceCells(t))).toBe('A —a→ B —b→ D')
  })

  it('records where a partial DFA stops', () => {
    const p = getPreset('dead-state')!.nfa
    const partial = subsetConstruction(p, { includeDeadState: false }).dfa
    const bad = p.alphabet.map((a) => [a]).find((tok) => !buildTrace(p, partial, tok).dfaAccepted && partial.transitions[partial.start]?.[tok[0]] === undefined)
    expect(bad).toBeDefined()
    const t = buildTrace(p, partial, [...bad!, ...bad!])
    expect(t.dfaStuckAt).toBe(1)
    expect(t.steps[0].dfaTo).toBeNull()
    expect(t.steps[1]).toMatchObject({ dfaFrom: null, dfaTo: null })
    expect(t.agree).toBe(true)
    expect(dfaTraceCells(t).at(-1)!.value).toBe('— (no move)')
  })

  it('agrees with the expected verdicts of every preset', () => {
    for (const p of presets) {
      const d = subsetConstruction(p.nfa).dfa
      for (const s of p.expected.accepts) {
        const c = checkInput(s, p.nfa.alphabet)
        expect(c.ok, `${p.id} ${s}`).toBe(true)
        if (c.ok) expect(buildTrace(p.nfa, d, c.tokens)).toMatchObject({ nfaAccepted: true, dfaAccepted: true })
      }
      for (const s of p.expected.rejects) {
        const c = checkInput(s, p.nfa.alphabet)
        if (c.ok) expect(buildTrace(p.nfa, d, c.tokens), `${p.id} ${s}`).toMatchObject({ nfaAccepted: false, dfaAccepted: false })
      }
    }
  })
})

describe('planRun', () => {
  it('has a start step plus one step per symbol, each ending on the settled sets', () => {
    const t = buildTrace(nfa, dfa, ['a', 'b', 'b'])
    const plan = planRun(nfa, t)
    expect(plan).toHaveLength(4)
    expect(plan[0][0]).toMatchObject({ phase: 'pulse', current: ['0'], dfaCurrent: 'A' })
    expect(plan[0].at(-1)).toMatchObject({ current: t.nfa.initial, dfaCurrent: 'A' })
    const move = plan[1][0]
    expect(move).toMatchObject({ phase: 'move', tokens: true, dfaToken: true, dfaEdge: { from: 'A', symbol: 'a', to: 'B' }, dfaCurrent: 'A' })
    expect(move.symbolEdges).toEqual([
      ['2', '3'],
      ['7', '8'],
    ])
    // States of {0,1,2,4,7} with no a-edge are dead branches and fade.
    expect(move.faded).toEqual(['0', '1', '4'])
    // The ε-closure spreads over several frames and reaches the whole set.
    const closures = plan[1].filter((f) => f.phase === 'closure')
    expect(closures.length).toBeGreaterThan(1)
    expect(closures.at(-1)!.closure).toEqual(t.steps[0].nfaAfter)
    expect(plan[1].at(-1)).toMatchObject({ phase: 'done', current: t.steps[0].nfaAfter, dfaCurrent: 'B' })
    expect(plan[3].at(-1)!.text).toMatch(/so the ε-NFA accepts; E is final, so the DFA accepts\.$/)
  })

  it('plans the empty string as the start step only, with the verdict', () => {
    const plan = planRun(nfa, buildTrace(nfa, dfa, []))
    expect(plan).toHaveLength(1)
    expect(plan[0].at(-1)!.text).toMatch(/ε-NFA rejects; A is not final, so the DFA rejects\.$/)
  })

  it('every frame has a positive duration', () => {
    const plan = planRun(nfa, buildTrace(nfa, dfa, ['b', 'a', 'b', 'b']))
    for (const frames of plan) for (const f of frames) expect(f.ms).toBeGreaterThan(0)
  })
})

describe('batch tester', () => {
  it('parses one string per line; empty lines and eps are ε; trailing blank lines are ignored', () => {
    expect(parseBatch('abb\n\neps\n ε \n aab \n\n\n')).toEqual(['abb', '', '', '', 'aab'])
    expect(parseBatch('')).toEqual([])
    expect(parseBatch('a\r\nb')).toEqual(['a', 'b'])
  })

  it('seeds the textarea from the preset, writing ε as eps', () => {
    const text = expectedBatchText(abb.expected)
    const lines = text.split('\n')
    expect(lines).toHaveLength(abb.expected.accepts.length + abb.expected.rejects.length)
    expect(lines).toContain('eps')
    expect(parseBatch(text)).toEqual([...abb.expected.accepts, ...abb.expected.rejects])
  })

  it('passes every expected string of every preset (expected vs generated)', () => {
    for (const p of presets) {
      const d = subsetConstruction(p.nfa).dfa
      const m = { nfa: p.nfa, dfa: d, min: minimizeDFA(d).dfa }
      const rows = runBatch(parseBatch(expectedBatchText(p.expected)), m, expectedIndex(p.expected, p.nfa.alphabet))
      for (const r of rows) {
        expect(r.status, `${p.id} "${r.raw}"`).toBe('pass')
        expect(r.expected).not.toBeNull()
      }
    }
  })

  it('marks a row FAIL when the generated result differs from the expected one', () => {
    const wrong = expectedIndex({ accepts: ['ab'], rejects: ['abb'] }, nfa.alphabet)
    const rows = runBatch(['ab', 'abb', 'aabb'], machines, wrong)
    expect(rows.map((r) => [r.expected, r.nfa, r.dfa, r.min, r.status])).toEqual([
      ['accept', 'reject', 'reject', 'reject', 'fail'],
      ['reject', 'accept', 'accept', 'accept', 'fail'],
      [null, 'accept', 'accept', 'accept', 'pass'],
    ])
  })

  it('marks a row FAIL when the machines disagree, even without an expected result', () => {
    const broken: DFA = { ...dfa, finals: [] }
    const rows = runBatch(['abb'], { nfa, dfa: broken, min })
    expect(rows[0]).toMatchObject({ nfa: 'accept', dfa: 'reject', min: 'accept', status: 'fail' })
  })

  it('reports an invalid symbol as INVALID (not a rejection) with its position', () => {
    const rows = runBatch(['abx'], machines)
    expect(rows[0]).toMatchObject({ status: 'invalid', nfa: null, dfa: null, min: null })
    expect(rows[0].error).toContain('position 2')
  })

  it('shows ε for the empty string and matches expected strings by symbols', () => {
    const p = getPreset('multi-char-symbols')!
    const d = subsetConstruction(p.nfa).dfa
    const rows = runBatch(['', 'ifx', 'if  x'], { nfa: p.nfa, dfa: d, min: minimizeDFA(d).dfa }, expectedIndex(p.expected, p.nfa.alphabet))
    expect(rows.map((r) => r.display)).toEqual(['ε', 'ifx', 'if  x'])
    expect(rows.map((r) => r.expected)).toEqual(['reject', 'accept', 'accept'])
  })

  it('summarises the counts', () => {
    const rows = runBatch(['abb', 'ab', 'abz', ''], machines, expectedIndex({ accepts: ['abb', 'ab'], rejects: [] }, nfa.alphabet))
    const s = batchSummary(rows)
    expect(s).toMatchObject({ total: 4, pass: 2, fail: 1, invalid: 1, withExpected: 2, accepted: 1, rejected: 2 })
    expect(s.text).toBe('4 strings: 2 pass, 1 fail, 1 invalid (1 accepted, 2 rejected)')
  })

  it('exports the table as CSV with the expected and generated columns', () => {
    const csv = batchCSV(runBatch(['abb', '', 'a,b'], machines, expectedIndex(abb.expected, nfa.alphabet)))
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('#,String,Expected,ε-NFA,DFA,Min-DFA,Status,Note')
    expect(lines[1]).toBe('1,abb,Accept,Accept,Accept,Accept,PASS,')
    expect(lines[2]).toBe('2,ε,Reject,Reject,Reject,Reject,PASS,')
    expect(lines[3]).toMatch(/^3,"a,b",—,—,—,—,INVALID,/)
  })
})

describe('single-string CSV and display', () => {
  it('lists both verdicts and one row per step', () => {
    const c = checkInput('ab', nfa.alphabet)
    const t = c.ok ? buildTrace(nfa, dfa, c.tokens) : null
    const lines = singleRunCSV('ab', c, t, nfa.alphabet).trimEnd().split('\r\n')
    expect(lines.slice(0, 4)).toEqual(['Input,ab', 'ε-NFA,Rejected', 'DFA,Rejected', 'Agree,yes'])
    expect(lines.at(-1)).toBe('2,b,ab,"{5,9}","{1,2,4,5,6,7,9}",D')
  })

  it('writes the invalid-input reason', () => {
    const c = checkInput('aq', nfa.alphabet)
    expect(singleRunCSV('aq', c, null, nfa.alphabet)).toContain('Invalid input')
  })

  it('joins multi-character symbols with spaces', () => {
    expect(showString(['if', 'x'], ['if', 'x'])).toBe('if x')
    expect(showString(['a', 'b'], ['a', 'b'])).toBe('ab')
    expect(showString([], ['a'])).toBe('ε')
  })
})

describe('equivalence message', () => {
  it('says how many strings agree up to the length', () => {
    const r = checkEquivalence(nfa, dfa, 3)
    expect(equivalenceMessage(r, 3, nfa.alphabet)).toEqual({ ok: true, text: 'ε-NFA and DFA agree on all 15 strings over Σ up to length 3.' })
  })

  it('shows the first counterexample', () => {
    const broken: DFA = { ...dfa, finals: [] }
    const m = equivalenceMessage(checkEquivalence(nfa, broken, 8), 8, nfa.alphabet)
    expect(m).toEqual({ ok: false, text: 'Counterexample “abb”: the ε-NFA accepts it but the DFA rejects it.' })
  })

  it('says when the cap stopped the search', () => {
    const m = equivalenceMessage(checkEquivalence(nfa, dfa, 10, 100), 10, nfa.alphabet)
    expect(m.ok).toBe(true)
    expect(m.text).toContain('first 100 strings')
  })
})

describe('Test store', () => {
  it('loads a run at its end so the verdict shows at once, and clamps the length bound', () => {
    useTest.getState().load([3, 4, 5], 'end')
    expect(useTest.getState()).toMatchObject({ step: 2, frame: 4, playing: false })
    useTest.getState().play()
    expect(useTest.getState()).toMatchObject({ step: 0, frame: 0, playing: true, live: true })
    useTest.getState().setMaxLen(42)
    expect(useTest.getState().maxLen).toBe(10)
    useTest.getState().setMaxLen(0)
    expect(useTest.getState().maxLen).toBe(1)
  })

  it('remembers the batch text at the last run', () => {
    useTest.getState().setBatchText('abb\nab')
    useTest.getState().runBatch()
    useTest.getState().setBatchText('abb')
    expect(useTest.getState().batchRun).toBe('abb\nab')
  })
})
