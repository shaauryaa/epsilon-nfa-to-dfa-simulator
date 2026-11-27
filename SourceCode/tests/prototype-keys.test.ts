import { describe, expect, it } from 'vitest'
import { EPSILON, fromJSON, isReservedName, isValidName, simulateDFA, subsetConstruction, tokenize, validateENFA, type DFA } from '../src/core'

describe('prototype keys (B6)', () => {
  it('isValidName rejects Object.prototype names', () => {
    for (const n of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
      expect(isReservedName(n)).toBe(true)
      expect(isValidName(n)).toBe(false)
    }
    for (const n of ['a', 'q0', 'proto', 'Constructor', 'ε']) expect(isReservedName(n)).toBe(false)
  })

  it('validateENFA reports a reserved symbol or state name clearly', () => {
    const v = validateENFA({ states: ['constructor'], alphabet: ['toString'], start: 'constructor', finals: [], transitions: {} })
    expect(v.errors.map((e) => e.code)).toEqual(['INVALID_NAME', 'INVALID_NAME'])
    expect(v.errors[0].message).toMatch(/reserved/)
  })

  it('fromJSON keeps a "__proto__" key as data, so validation can report it', () => {
    const nfa = fromJSON('{"version":1,"states":["__proto__","b"],"alphabet":["a"],"start":"b","finals":[],"transitions":{"__proto__":{"a":["b"]}}}')
    expect(Object.hasOwn(nfa.transitions, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(nfa.transitions)).toBe(Object.prototype)
    expect(nfa.transitions['__proto__'].a).toEqual(['b'])
    expect(validateENFA(nfa).errors.some((e) => e.code === 'INVALID_NAME' && e.state === '__proto__')).toBe(true)
  })

  it('simulateDFA never follows an inherited transition', () => {
    const dfa: DFA = { states: ['A'], alphabet: ['x'], start: 'A', finals: [], transitions: { A: {} }, subsets: { A: ['0'] }, deadState: null }
    const run = simulateDFA(dfa, ['constructor'])
    expect(run.accepted).toBe(false)
    expect(run.steps[0].to).toBeNull()
    expect(run.steps[0].explanation).not.toMatch(/native code/)
    const run2 = simulateDFA({ ...dfa, start: 'toString' }, ['x'])
    expect(run2.steps[0].to).toBeNull()
  })

  it('a partial DFA still works for ordinary symbols', () => {
    const nfa = { states: ['p', 'q'], alphabet: ['a', 'b'], start: 'p', finals: ['q'], transitions: { p: { a: ['q'] } } }
    const dfa = subsetConstruction(nfa, { includeDeadState: false }).dfa
    expect(simulateDFA(dfa, ['a']).accepted).toBe(true)
    expect(simulateDFA(dfa, ['b']).accepted).toBe(false)
  })
})

describe('a lone ε means the empty string (B8)', () => {
  it('tokenize reads "ε" (with optional spaces) as []', () => {
    expect(tokenize('ε', ['a', 'b'])).toEqual([])
    expect(tokenize('  ε ', ['a', 'b'])).toEqual([])
    expect(tokenize(EPSILON, ['ab', 'c'])).toEqual([])
  })

  it('ε inside a longer input is still an error', () => {
    expect(() => tokenize('aε', ['a', 'b'])).toThrow(/"ε" at position 1/)
  })
})
