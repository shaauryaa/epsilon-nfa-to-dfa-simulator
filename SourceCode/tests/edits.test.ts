import { describe, expect, it } from 'vitest'
import { EPSILON, parseText, toText, validateENFA, type ENFA } from '../src/core'
import {
  addState,
  addSymbol,
  addTransition,
  blankENFA,
  checkName,
  cloneENFA,
  deleteState,
  deleteSymbol,
  nextStateName,
  nextSymbolName,
  parseTargets,
  renameState,
  renameSymbol,
  setFinal,
  setStart,
  setTargets,
} from '../src/model/edits'
import { getPreset } from '../src/presets'

const E = EPSILON
const sample = (): ENFA => ({
  states: ['q0', 'q1', 'q2'],
  alphabet: ['a', 'b'],
  start: 'q0',
  finals: ['q2'],
  transitions: { q0: { a: ['q0', 'q1'], [E]: ['q2'] }, q1: { b: ['q2'] }, q2: { a: ['q0'] } },
})

describe('edits never mutate their input', () => {
  it('leaves the original untouched', () => {
    const nfa = sample()
    const before = JSON.stringify(nfa)
    renameState(nfa, 'q0', 'x')
    deleteState(nfa, 'q1')
    renameSymbol(nfa, 'a', 'c')
    deleteSymbol(nfa, 'a')
    setTargets(nfa, 'q0', 'a', [])
    addTransition(nfa, 'q1', 'a', 'q0')
    setFinal(nfa, 'q0', true)
    setStart(nfa, 'q1')
    addState(nfa)
    addSymbol(nfa)
    expect(JSON.stringify(nfa)).toBe(before)
  })

  it('cloneENFA shares no arrays', () => {
    const nfa = sample()
    const c = cloneENFA(nfa)
    c.transitions.q0.a.push('q2')
    c.states.push('z')
    expect(nfa.transitions.q0.a).toEqual(['q0', 'q1'])
    expect(nfa.states).toHaveLength(3)
  })
})

describe('naming', () => {
  it('continues numeric names', () => {
    expect(nextStateName(getPreset('thompson-abb')!.nfa.states)).toBe('11')
  })
  it('continues a shared prefix', () => {
    expect(nextStateName(['q0', 'q1', 'q3'])).toBe('q4')
    expect(nextStateName(['s1', 's2'])).toBe('s3')
  })
  it('falls back to q0 for an empty machine and skips taken names', () => {
    expect(nextStateName([])).toBe('q0')
    expect(nextStateName(['A', 'B'])).toBe('q0')
  })
  it('picks the next free symbol and never e (an ε keyword)', () => {
    expect(nextSymbolName(['a', 'b'])).toBe('c')
    expect(nextSymbolName(['a', 'b', 'c', 'd'])).toBe('f')
    expect(nextSymbolName([])).toBe('a')
  })
  it('checkName rejects blanks, separators, ε and duplicates', () => {
    expect(checkName('', [], 'state')).toMatch(/Enter/)
    expect(checkName('q 1', [], 'state')).toMatch(/spaces/)
    expect(checkName('a,b', [], 'symbol')).toMatch(/commas/)
    expect(checkName(E, [], 'symbol')).toMatch(/reserved/)
    expect(checkName('q1', ['q1'], 'state')).toMatch(/already a state/)
    expect(checkName('q9', ['q1'], 'state')).toBeNull()
  })
})

describe('parseTargets', () => {
  it('splits on commas and spaces, dropping blanks and repeats', () => {
    expect(parseTargets(' q1, q2 ,,q1  q3 ')).toEqual(['q1', 'q2', 'q3'])
    expect(parseTargets('')).toEqual([])
  })
})

describe('state edits', () => {
  it('renameState updates states, start, finals, sources and targets', () => {
    const out = renameState(sample(), 'q0', 'start')
    expect(out.states).toEqual(['start', 'q1', 'q2'])
    expect(out.start).toBe('start')
    expect(out.transitions.start.a).toEqual(['start', 'q1'])
    expect(out.transitions.q2.a).toEqual(['start'])
    expect(out.transitions.q0).toBeUndefined()
    expect(validateENFA(out).errors).toEqual([])
  })

  it('deleteState removes every reference and clears the start', () => {
    const out = deleteState(sample(), 'q0')
    expect(out.states).toEqual(['q1', 'q2'])
    expect(out.start).toBe('')
    expect(out.transitions.q2).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain('"q0"')
    expect(validateENFA(out).errors.map((e) => e.code)).toEqual(['NO_START'])
  })

  it('deleteState of a final state drops it from finals', () => {
    expect(deleteState(sample(), 'q2').finals).toEqual([])
  })

  it('addState on an empty machine makes the state the start', () => {
    const { nfa, name } = addState({ states: [], alphabet: ['a'], start: '', finals: [], transitions: {} })
    expect(name).toBe('q0')
    expect(nfa.start).toBe('q0')
  })
})

describe('symbol edits', () => {
  it('renameSymbol renames the column and every transition key', () => {
    const out = renameSymbol(sample(), 'a', 'x')
    expect(out.alphabet).toEqual(['x', 'b'])
    expect(out.transitions.q0).toEqual({ x: ['q0', 'q1'], [E]: ['q2'] })
    expect(validateENFA(out).errors).toEqual([])
  })

  it('deleteSymbol removes transitions on it and empty rows', () => {
    const out = deleteSymbol(sample(), 'a')
    expect(out.alphabet).toEqual(['b'])
    expect(out.transitions).toEqual({ q0: { [E]: ['q2'] }, q1: { b: ['q2'] } })
  })
})

describe('cell edits', () => {
  it('setTargets replaces and an empty list deletes the entry', () => {
    expect(setTargets(sample(), 'q1', 'a', ['q0']).transitions.q1).toEqual({ a: ['q0'], b: ['q2'] })
    expect(setTargets(sample(), 'q1', 'b', []).transitions.q1).toBeUndefined()
  })

  it('addTransition appends once', () => {
    const once = addTransition(sample(), 'q1', 'b', 'q0')
    expect(once.transitions.q1.b).toEqual(['q2', 'q0'])
    expect(addTransition(once, 'q1', 'b', 'q0').transitions.q1.b).toEqual(['q2', 'q0'])
    expect(addTransition(sample(), 'q2', 'a', 'q2').transitions.q2.a).toEqual(['q0', 'q2'])
  })

  it('setFinal keeps declaration order', () => {
    expect(setFinal(sample(), 'q0', true).finals).toEqual(['q0', 'q2'])
    expect(setFinal(sample(), 'q2', false).finals).toEqual([])
  })

  it('edits round-trip through the text format', () => {
    const edited = addTransition(renameSymbol(sample(), 'b', 'eps'), 'q1', E, 'q0')
    expect(parseText(toText(edited))).toEqual(edited)
  })
})

describe('blankENFA', () => {
  it('is valid with only warnings', () => {
    const v = validateENFA(blankENFA())
    expect(v.errors).toEqual([])
    expect(v.warnings.map((w) => w.code)).toEqual(['NO_FINALS', 'NO_EPSILON'])
  })
})
