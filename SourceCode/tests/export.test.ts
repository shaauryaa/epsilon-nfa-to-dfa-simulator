import { describe, expect, it } from 'vitest'
import {
  codeExamples,
  dfaToCSV,
  dfaToDot,
  dfaToENFA,
  dfaToJavaScript,
  dfaToJFLAP,
  dfaToJSON,
  dfaToPython,
  dfaToText,
  exportFileName,
  fromJSON,
  JFLAPError,
  parseJFLAP,
  parseText,
  simulateDFA,
  stepLogText,
  subsetConstruction,
  tokenize,
  validateENFA,
  type DFA,
} from '../src/core'
import { getPreset, presets } from '../src/presets'

const thompson = getPreset('thompson-abb')!.nfa
const abb = subsetConstruction(thompson).dfa

/** Loads generated JavaScript and returns its `accepts` function. */
function loadAccepts(source: string): (s: string) => boolean {
  const body = source.replace('export function accepts', 'function accepts').replace(/^console\.log.*$/gm, '')
  return new Function(`${body}\nreturn accepts`)() as (s: string) => boolean
}

describe('dfaToENFA, JSON and text', () => {
  it('turns every DFA move into a one-target list', () => {
    const nfa = dfaToENFA(abb)
    expect(nfa.states).toEqual(abb.states)
    expect(nfa.transitions.A).toEqual({ a: ['B'], b: ['C'] })
    expect(validateENFA(nfa).errors).toEqual([])
  })

  it('JSON re-imports as the same machine', () => {
    expect(fromJSON(dfaToJSON(abb))).toEqual(dfaToENFA(abb))
  })

  it('text parses back to the same machine', () => {
    expect(parseText(dfaToText(abb))).toEqual(dfaToENFA(abb))
  })

  it('keeps a partial DFA partial', () => {
    const partial = subsetConstruction(getPreset('dead-state')!.nfa, { includeDeadState: false }).dfa
    const nfa = dfaToENFA(partial)
    const moves = Object.values(nfa.transitions).reduce((n, row) => n + Object.keys(row).length, 0)
    expect(moves).toBeLessThan(partial.states.length * partial.alphabet.length)
    expect(parseText(dfaToText(partial))).toEqual(nfa)
  })
})

describe('JFLAP', () => {
  it('round-trips every preset DFA: export, parse the XML back, compare', () => {
    for (const p of presets) {
      const dfa = subsetConstruction(p.nfa).dfa
      const positions = Object.fromEntries(dfa.states.map((s, i) => [s, { x: i * 100, y: 40 }]))
      const { nfa, positions: read } = parseJFLAP(dfaToJFLAP(dfa, positions))
      expect(nfa.states).toEqual(dfa.states)
      expect(nfa.start).toBe(dfa.start)
      expect(nfa.finals).toEqual(dfa.finals)
      expect(nfa.transitions).toEqual(dfaToENFA(dfa).transitions)
      expect(new Set(nfa.alphabet)).toEqual(new Set(dfa.alphabet.filter((a) => dfa.states.some((s) => dfa.transitions[s][a]))))
      if (dfa.states.length > 1) expect(read[dfa.states[1]]).toEqual({ x: 100 + 28 + 60, y: 40 + 28 + 60 })
    }
  })

  it('writes states, initial, final and transitions in JFLAP structure', () => {
    const xml = dfaToJFLAP(abb)
    expect(xml).toMatch(/^<\?xml version="1.0"/)
    expect(xml).toContain('<type>fa</type>')
    expect(xml.match(/<state /g)).toHaveLength(abb.states.length)
    expect(xml.match(/<initial\/>/g)).toHaveLength(1)
    expect(xml.match(/<final\/>/g)).toHaveLength(abb.finals.length)
    expect(xml.match(/<transition>/g)).toHaveLength(abb.states.length * abb.alphabet.length)
    expect(xml).toMatch(/<x>\d+\.\d<\/x>/)
  })

  it('escapes XML characters in names and symbols', () => {
    const dfa: DFA = {
      states: ['<p>', 'q&'],
      alphabet: ['"'],
      start: '<p>',
      finals: ['q&'],
      transitions: { '<p>': { '"': 'q&' }, 'q&': {} },
      subsets: {},
      deadState: null,
    }
    const xml = dfaToJFLAP(dfa)
    expect(xml).toContain('name="&lt;p&gt;"')
    const back = parseJFLAP(xml).nfa
    expect(back.states).toEqual(['<p>', 'q&'])
    expect(back.transitions['<p>']['"']).toEqual(['q&'])
  })

  it('reads an empty <read/> as ε', () => {
    const xml = `<structure><type>fa</type><automaton>
      <state id="0" name="q0"><initial/></state><state id="1" name="q1"><final/></state>
      <transition><from>0</from><to>1</to><read/></transition></automaton></structure>`
    expect(parseJFLAP(xml).nfa.transitions.q0).toEqual({ ε: ['q1'] })
  })

  it('rejects files that are not finite automata', () => {
    expect(() => parseJFLAP('<structure><type>pda</type><automaton></automaton></structure>')).toThrow(JFLAPError)
    expect(() => parseJFLAP('<structure><type>fa</type><automaton><state id="0"/></automaton></structure>')).toThrow(/initial/)
  })
})

describe('dfaToDot', () => {
  it('draws finals as double circles, merges parallel labels and marks the start', () => {
    const dot = dfaToDot(abb, 'abb')
    expect(dot).toMatch(/^digraph "abb" \{/)
    expect(dot).toContain('__start -> "A";')
    expect(dot).toMatch(/"E" \[shape=doublecircle/)
    const dead = subsetConstruction(getPreset('dead-state')!.nfa).dfa
    expect(dfaToDot(dead)).toMatch(/"∅" -> "∅" \[label="[^"]*, [^"]*"\]/)
  })
})

describe('dfaToCSV', () => {
  it('has a header, one row per state and quotes cells with commas', () => {
    const csv = dfaToCSV(abb)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('State,NFA states,Start,Final,a,b')
    expect(lines).toHaveLength(abb.states.length + 1)
    expect(lines[1]).toBe('A,"{0,1,2,4,7}",yes,,B,C')
    expect(lines.find((l) => l.startsWith('E,'))).toMatch(/,yes,/)
  })
})

describe('generated code', () => {
  it('JavaScript accepts exactly what the DFA accepts, for every preset', () => {
    for (const p of presets) {
      const dfa = subsetConstruction(p.nfa).dfa
      const accepts = loadAccepts(dfaToJavaScript(dfa, p.name))
      for (const s of [...p.expected.accepts, ...p.expected.rejects]) {
        expect(accepts(s), `${p.id}: "${s}"`).toBe(simulateDFA(dfa, tokenize(s, dfa.alphabet)).accepted)
      }
      expect(accepts('?')).toBe(false)
    }
  })

  it('JavaScript works for a partial DFA', () => {
    const p = getPreset('dead-state')!
    const dfa = subsetConstruction(p.nfa, { includeDeadState: false }).dfa
    const accepts = loadAccepts(dfaToJavaScript(dfa))
    for (const s of p.expected.accepts) expect(accepts(s)).toBe(true)
    for (const s of p.expected.rejects) expect(accepts(s)).toBe(false)
  })

  it('Python defines the table, accepts() with a docstring and example calls', () => {
    const py = dfaToPython(abb, 'abb')
    expect(py).toContain('def accepts(text: str) -> bool:')
    expect(py).toContain('"""Return True if the DFA accepts text.')
    expect(py).toContain('TRANSITIONS = {')
    expect(py).toContain('    "A": {"a": "B", "b": "C"},')
    expect(py).toContain('FINALS = {"E"}')
    expect(py).toContain('print("abb", accepts("abb"))  # True')
    expect(py).toContain('if __name__ == "__main__":')
  })

  it('codeExamples gives accepted strings first, with correct verdicts', () => {
    const ex = codeExamples(abb)
    expect(ex.filter((e) => e.accepted).map((e) => e.input)).toEqual(['abb', 'aabb', 'babb'])
    expect(ex.filter((e) => !e.accepted).map((e) => e.input)).toEqual(['', 'a'])
  })
})

describe('stepLogText and exportFileName', () => {
  it('lists every step and the state mapping', () => {
    const result = subsetConstruction(thompson)
    const log = stepLogText(thompson, result, 'abb')
    for (const s of result.steps) expect(log).toContain(s.explanation)
    expect(log).toContain('  A = {0,1,2,4,7}  (start)')
    expect(log).toContain('(bound 2^11 = 2048)')
  })

  it('builds slugged, time-stamped names', () => {
    const when = new Date(2026, 10, 27, 4, 7)
    expect(exportFileName('thompson-abb', 'dfa', 'jff', when)).toBe('thompson-abb-dfa-20261127-0407.jff')
    expect(exportFileName('My ε machine!', 'report', 'pdf', when)).toBe('my-machine-report-20261127-0407.pdf')
    expect(exportFileName('', 'dfa', 'csv', when)).toBe('machine-dfa-20261127-0407.csv')
  })
})
