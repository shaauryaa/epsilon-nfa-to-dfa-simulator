import { describe, expect, it } from 'vitest'
import {
  FormatError,
  ParseError,
  assertValidENFA,
  fromJSON,
  isValidName,
  parseText,
  toJSON,
  toText,
  validateENFA,
} from '../src/core/automaton'
import { EPSILON } from '../src/core/types'
import { presets } from '../src/presets'
import { validationCases } from '../src/presets/validation'

describe('validateENFA', () => {
  it('accepts every preset without errors', () => {
    for (const p of presets) expect(validateENFA(p.nfa).errors, p.id).toEqual([])
  })

  for (const c of validationCases) {
    it(`reports ${c.code} (${c.description})`, () => {
      const { errors, warnings } = validateENFA(c.nfa)
      const list = c.severity === 'error' ? errors : warnings
      expect(list.map((i) => i.code)).toContain(c.code)
      if (c.severity === 'warning') expect(errors).toEqual([])
    })
  }

  it('attaches the offending state or symbol', () => {
    const byCode = (code: string) => validationCases.find((c) => c.code === code)!.nfa
    expect(validateENFA(byCode('UNKNOWN_SYMBOL')).errors[0]).toMatchObject({ state: 'q0', symbol: 'b' })
    expect(validateENFA(byCode('UNREACHABLE_STATE')).warnings[0]).toMatchObject({ state: 'q2' })
    expect(validateENFA(byCode('DUPLICATE_STATE')).errors[0]).toMatchObject({ state: 'q1' })
  })

  it('flags names with commas and blank symbols as INVALID_NAME', () => {
    const nfa = { states: ['a,b'], alphabet: [''], start: 'a,b', finals: [], transitions: {} }
    const codes = validateENFA(nfa).errors.map((e) => e.code)
    expect(codes.filter((c) => c === 'INVALID_NAME')).toHaveLength(2)
    expect(isValidName('q0')).toBe(true)
    expect(isValidName('q 0')).toBe(false)
  })

  it('assertValidENFA throws on errors only', () => {
    expect(() => assertValidENFA(presets[0].nfa)).not.toThrow()
    expect(() => assertValidENFA(validationCases[0].nfa)).toThrow(/Invalid automaton/)
  })
})

describe('parseText / toText', () => {
  const sample = `# comment line
states: q0 q1 q2
alphabet: a b
start: q0
final: q2   # trailing comment

q0 a -> q0 q1
q0 eps -> q1
q1 b -> q2
q1 ε -> q2
q2 epsilon -> q0
q2 e -> q1
`

  it('parses the documented format', () => {
    expect(parseText(sample)).toEqual({
      states: ['q0', 'q1', 'q2'],
      alphabet: ['a', 'b'],
      start: 'q0',
      finals: ['q2'],
      transitions: {
        q0: { a: ['q0', 'q1'], [EPSILON]: ['q1'] },
        q1: { b: ['q2'], [EPSILON]: ['q2'] },
        q2: { [EPSILON]: ['q0', 'q1'] },
      },
    })
  })

  it('treats e as a symbol when it is in the alphabet', () => {
    const nfa = parseText('states: p q\nalphabet: e f\nstart: p\nfinal: q\np e -> q\np eps -> q')
    expect(nfa.transitions.p).toEqual({ e: ['q'], [EPSILON]: ['q'] })
  })

  it('accepts commas, CRLF line endings, "finals:" and headers after transitions', () => {
    const nfa = parseText('p a -> p, q\r\nstates: p, q\r\nalphabet: a\r\nstart: p\r\nfinals: q\r\np a -> q')
    expect(nfa.states).toEqual(['p', 'q'])
    expect(nfa.finals).toEqual(['q'])
    expect(nfa.transitions.p.a).toEqual(['p', 'q'])
  })

  it('round-trips every preset', () => {
    for (const p of presets) expect(parseText(toText(p.nfa)), p.id).toEqual(p.nfa)
  })

  it('writes ε as eps unless eps is a symbol', () => {
    expect(toText(presets[0].nfa)).toContain('0 eps -> 1 7')
    const nfa = { states: ['p'], alphabet: ['eps'], start: 'p', finals: [], transitions: { p: { [EPSILON]: ['p'], eps: ['p'] } } }
    expect(toText(nfa)).toContain('p ε -> p')
    expect(parseText(toText(nfa))).toEqual(nfa)
  })

  const bad: [string, number, RegExp][] = [
    ['states: a\nbogus line', 2, /expected "key: values"/],
    ['states: a\nfoo: bar', 2, /unknown header/],
    ['states: a\nstates: b', 2, /more than once/],
    ['start: a b', 1, /exactly one/],
    ['start:', 1, /exactly one/],
    ['\n\np -> q', 3, /source symbol -> targets/],
    ['p a b -> q', 1, /source symbol -> targets/],
    ['p a ->', 1, /at least one target/],
  ]
  for (const [text, line, msg] of bad) {
    it(`throws ParseError on line ${line} for ${JSON.stringify(text)}`, () => {
      try {
        parseText(text)
        expect.unreachable()
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError)
        expect((e as ParseError).line).toBe(line)
        expect((e as ParseError).message).toMatch(msg)
      }
    })
  }
})

describe('toJSON / fromJSON', () => {
  it('round-trips every preset with a version field', () => {
    for (const p of presets) {
      const json = toJSON(p.nfa)
      expect(JSON.parse(json)).toMatchObject({ format: 'enfa', version: 1 })
      expect(fromJSON(json)).toEqual(p.nfa)
    }
  })

  it('ignores extra keys', () => {
    expect(fromJSON(JSON.stringify({ ...JSON.parse(toJSON(presets[0].nfa)), id: 'x' }))).toEqual(presets[0].nfa)
  })

  const bad: [string, RegExp][] = [
    ['not json', /Not valid JSON/],
    ['[]', /JSON object/],
    ['{"states":[]}', /Missing "version"/],
    ['{"version":2}', /Unsupported version 2/],
    ['{"version":1,"states":"a"}', /"states"/],
    ['{"version":1,"states":[],"alphabet":[1]}', /"alphabet"/],
    ['{"version":1,"states":[],"alphabet":[],"start":0}', /"start"/],
    ['{"version":1,"states":[],"alphabet":[],"start":"","finals":null}', /"finals"/],
    ['{"version":1,"states":[],"alphabet":[],"start":"","finals":[],"transitions":[]}', /"transitions"/],
    ['{"version":1,"states":[],"alphabet":[],"start":"","finals":[],"transitions":{"p":1}}', /transitions\.p/],
    ['{"version":1,"states":[],"alphabet":[],"start":"","finals":[],"transitions":{"p":{"a":"q"}}}', /transitions\.p\.a/],
  ]
  for (const [json, msg] of bad) {
    it(`rejects ${json}`, () => {
      expect(() => fromJSON(json)).toThrow(FormatError)
      expect(() => fromJSON(json)).toThrow(msg)
    })
  }
})
