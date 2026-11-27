import { describe, expect, it } from 'vitest'
import {
  detectFormat,
  dfaToENFA,
  dfaToJFLAP,
  dfaToJSON,
  dfaToText,
  ImportError,
  importMachine,
  subsetConstruction,
  toJSON,
  toText,
  type ENFA,
} from '../src/core'
import { layoutDFA } from '../src/model/dfaLayout'
import { presets } from '../src/presets'

/** Same machine: states, start, finals and transitions; alphabet as a set (JFLAP lists symbols by first use). */
function expectSame(a: ENFA, b: ENFA) {
  expect(a.states).toEqual(b.states)
  expect(a.start).toBe(b.start)
  expect([...a.finals].sort()).toEqual([...b.finals].sort())
  expect([...a.alphabet].sort()).toEqual([...b.alphabet].sort())
  const norm = (m: ENFA) =>
    Object.fromEntries(
      Object.entries(m.transitions)
        .map(([s, row]) => [s, Object.fromEntries(Object.entries(row).filter(([, t]) => t.length > 0).map(([k, t]) => [k, [...t].sort()]))] as const)
        .filter(([, row]) => Object.keys(row).length > 0),
    )
  expect(norm(a)).toEqual(norm(b))
}

describe('detectFormat', () => {
  it('uses the extension first, then the content', () => {
    expect(detectFormat('a.JSON', '')).toBe('json')
    expect(detectFormat('a.jff', '')).toBe('jff')
    expect(detectFormat('a.txt', '')).toBe('txt')
    expect(detectFormat('machine', '  {"version":1}')).toBe('json')
    expect(detectFormat('machine.xml', '<?xml version="1.0"?>')).toBe('jff')
    expect(detectFormat('machine', 'states: a')).toBe('txt')
  })
})

describe('import round trip: export → import gives the same machine', () => {
  for (const preset of presets) {
    const dfa = subsetConstruction(preset.nfa).dfa
    const asNfa = dfaToENFA(dfa)
    it(`${preset.id}: DFA as .jff, .json and .txt`, () => {
      const jff = importMachine('dfa.jff', dfaToJFLAP(dfa, layoutDFA(dfa)))
      expect(jff.format).toBe('jff')
      expectSame(jff.nfa, asNfa)
      expect(Object.keys(jff.positions ?? {})).toHaveLength(dfa.states.length)
      const json = importMachine('dfa.json', dfaToJSON(dfa))
      expect(json.format).toBe('json')
      expectSame(json.nfa, asNfa)
      const txt = importMachine('dfa.txt', dfaToText(dfa))
      expect(txt.format).toBe('txt')
      expectSame(txt.nfa, asNfa)
    })
    it(`${preset.id}: ε-NFA as .json and .txt`, () => {
      expectSame(importMachine('m.json', toJSON(preset.nfa)).nfa, preset.nfa)
      expectSame(importMachine('m.txt', toText(preset.nfa)).nfa, preset.nfa)
    })
  }

  it('JFLAP positions come back as top-left corners (shifted by the export margin)', () => {
    const dfa = subsetConstruction(presets[0].nfa).dfa
    const layout = layoutDFA(dfa)
    const { positions } = importMachine('d.jff', dfaToJFLAP(dfa, layout))
    const [s0] = dfa.states
    const dx = positions![s0].x - layout[s0].x
    const dy = positions![s0].y - layout[s0].y
    for (const s of dfa.states) {
      expect(positions![s].x - dx).toBeCloseTo(layout[s].x, 0)
      expect(positions![s].y - dy).toBeCloseTo(layout[s].y, 0)
    }
  })

  it('a renamed file still loads by content', () => {
    const dfa = subsetConstruction(presets[0].nfa).dfa
    expect(importMachine('dfa.json', dfaToJFLAP(dfa)).format).toBe('jff')
    expect(importMachine('dfa.jff', dfaToJSON(dfa)).format).toBe('json')
    expect(importMachine('notes.txt', dfaToJSON(dfa)).format).toBe('json')
  })
})

describe('import errors are friendly', () => {
  const fail = (name: string, text: string) => {
    try {
      importMachine(name, text)
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
      return (e as ImportError).message
    }
    throw new Error('expected an ImportError')
  }
  it('names the format it tried', () => {
    expect(fail('x.json', '{"states": 3}')).toMatch(/^This looks like a JSON file, but missing "version" field\./)
    expect(fail('x.jff', '<structure><type>pda</type></structure>')).toMatch(/^This looks like a JFLAP file, but expected a finite automaton/)
    expect(fail('x.txt', 'states q0\nnonsense')).toMatch(/^This looks like the text format, but line 1:/)
    expect(fail('x.txt', '   \n')).toBe('The file is empty.')
  })
})
