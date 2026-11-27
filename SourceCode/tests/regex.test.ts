import { describe, expect, it } from 'vitest'
import { validateENFA } from '../src/core/automaton'
import { allStrings } from '../src/core/equivalence'
import { minimizeDFA } from '../src/core/minimize'
import { parseRegex, regexToENFA, RegexSyntaxError, thompson, type RegexNode } from '../src/core/regex'
import { simulateENFA } from '../src/core/simulate'
import { subsetConstruction } from '../src/core/subset'
import { EPSILON } from '../src/core/types'
import { getPreset } from '../src/presets'
import { mulberry32 } from './helpers'

/** Compact prefix form of an AST, for readable precedence tests. */
function show(n: RegexNode): string {
  switch (n.kind) {
    case 'symbol':
      return n.symbol
    case 'epsilon':
      return 'ε'
    case 'union':
      return `|(${show(n.left)},${show(n.right)})`
    case 'concat':
      return `.(${show(n.left)},${show(n.right)})`
    case 'star':
      return `*(${show(n.inner)})`
    case 'optional':
      return `?(${show(n.inner)})`
  }
}

function syntaxError(source: string): RegexSyntaxError {
  try {
    parseRegex(source)
  } catch (e) {
    if (e instanceof RegexSyntaxError) return e
    throw e
  }
  throw new Error(`"${source}" parsed without an error`)
}

describe('parseRegex', () => {
  it('gives * and ? higher precedence than concatenation, and concatenation higher than union', () => {
    expect(show(parseRegex('ab*'))).toBe('.(a,*(b))')
    expect(show(parseRegex('a|bc'))).toBe('|(a,.(b,c))')
    expect(show(parseRegex('ab?|c*'))).toBe('|(.(a,?(b)),*(c))')
    expect(show(parseRegex('(a|b)*abb'))).toBe('.(.(.(*(|(a,b)),a),b),b)')
  })

  it('is left-associative and accepts + as union', () => {
    expect(show(parseRegex('a|b|c'))).toBe('|(|(a,b),c)')
    expect(show(parseRegex('a+b+c'))).toBe(show(parseRegex('a|b|c')))
    expect(show(parseRegex('abc'))).toBe('.(.(a,b),c)')
  })

  it('reads ε and eps as the empty string, ignores spaces and allows repeated postfix operators', () => {
    expect(show(parseRegex('ε|a'))).toBe('|(ε,a)')
    expect(show(parseRegex('eps | a'))).toBe('|(ε,a)')
    expect(show(parseRegex(' ( 0 1 ) * ? '))).toBe('?(*(.(0,1)))')
  })

  it.each([
    ['', 1, 'empty'],
    ['   ', 4, 'empty'],
    ['a|', 3, 'end'],
    ['|a', 1, 'before it'],
    ['a||b', 3, 'before it'],
    ['*a', 1, 'before it'],
    ['()', 2, 'before ")"'],
    ['(a|b', 5, 'Missing ")"'],
    ['a)b', 2, 'no matching'],
    ['ab#', 3, 'not allowed'],
    ['A', 1, 'not allowed'],
  ])('rejects %j at position %i (1-based)', (source, position, text) => {
    const e = syntaxError(source)
    expect(e.position).toBe(position)
    expect(e.message).toContain(text)
  })
})

describe('thompson', () => {
  it('builds exactly the textbook Thompson preset for (a|b)*abb (states 0–10)', () => {
    const nfa = regexToENFA('(a|b)*abb')
    expect(nfa).toEqual(getPreset('thompson-abb')!.nfa)
    const { dfa } = subsetConstruction(nfa, { includeDeadState: false })
    expect(dfa.states).toHaveLength(5)
    expect(minimizeDFA(dfa).dfa.states).toHaveLength(4)
  })

  it('numbers states 0..n-1 in construction order with one final state', () => {
    expect(regexToENFA('a')).toEqual({ states: ['0', '1'], alphabet: ['a'], start: '0', finals: ['1'], transitions: { '0': { a: ['1'] } } })
    expect(regexToENFA('a*')).toEqual({
      states: ['0', '1', '2', '3'],
      alphabet: ['a'],
      start: '0',
      finals: ['3'],
      transitions: { '0': { [EPSILON]: ['1', '3'] }, '1': { a: ['2'] }, '2': { [EPSILON]: ['1', '3'] } },
    })
    const nfa = regexToENFA('(ab|c)?1')
    expect(nfa.alphabet).toEqual(['1', 'a', 'b', 'c'])
    expect(validateENFA(nfa).errors).toEqual([])
  })

  it('gives an empty alphabet (a validation error) when the regex has no symbols', () => {
    const nfa = regexToENFA('eps')
    expect(nfa.alphabet).toEqual([])
    expect(simulateENFA(nfa, []).accepted).toBe(true)
    expect(validateENFA(nfa).errors.map((e) => e.code)).toContain('EMPTY_ALPHABET')
  })
})

// ---- property test -------------------------------------------------------

function randomAst(rand: () => number, depth: number): RegexNode {
  const r = rand()
  if (depth <= 0 || r < 0.3) {
    if (rand() < 0.1) return { kind: 'epsilon' }
    return { kind: 'symbol', symbol: rand() < 0.5 ? 'a' : 'b' }
  }
  if (r < 0.55) return { kind: 'concat', left: randomAst(rand, depth - 1), right: randomAst(rand, depth - 1) }
  if (r < 0.75) return { kind: 'union', left: randomAst(rand, depth - 1), right: randomAst(rand, depth - 1) }
  if (r < 0.9) return { kind: 'star', inner: randomAst(rand, depth - 1) }
  return { kind: 'optional', inner: randomAst(rand, depth - 1) }
}

const PREC = { union: 0, concat: 1, star: 2, optional: 2, symbol: 3, epsilon: 3 } as const

/** Prints our syntax with as few parentheses as precedence allows, mixing | / + and ε / eps. */
function print(n: RegexNode, rand: () => number): string {
  const wrap = (child: RegexNode, min: number) => (PREC[child.kind] < min ? `(${print(child, rand)})` : print(child, rand))
  switch (n.kind) {
    case 'symbol':
      return n.symbol
    case 'epsilon':
      return rand() < 0.5 ? 'ε' : 'eps'
    case 'union':
      return `${wrap(n.left, 0)}${rand() < 0.5 ? '|' : '+'}${wrap(n.right, 1)}`
    case 'concat':
      return `${wrap(n.left, 1)}${wrap(n.right, 2)}`
    case 'star':
      return `${wrap(n.inner, 2)}*`
    case 'optional':
      return `${wrap(n.inner, 2)}?`
  }
}

/** The same language as a JavaScript RegExp source, fully grouped. */
function toJs(n: RegexNode): string {
  switch (n.kind) {
    case 'symbol':
      return n.symbol
    case 'epsilon':
      return '(?:)'
    case 'union':
      return `(?:${toJs(n.left)}|${toJs(n.right)})`
    case 'concat':
      return `(?:${toJs(n.left)}${toJs(n.right)})`
    case 'star':
      return `(?:${toJs(n.inner)})*`
    case 'optional':
      return `(?:${toJs(n.inner)})?`
  }
}

describe('property: Thompson ε-NFA ≡ JavaScript RegExp', () => {
  it('agree on every string over {a, b} up to length 6 for 150 random regexes', () => {
    const rand = mulberry32(20261127)
    const strings = [...allStrings(['a', 'b'], 6)]
    expect(strings).toHaveLength(127)
    for (let i = 0; i < 150; i++) {
      const ast = randomAst(rand, 4)
      const source = print(ast, rand)
      // Printing and re-parsing must give the same tree (tests precedence and associativity).
      expect(show(parseRegex(source)), source).toBe(show(ast))
      const nfa = thompson(parseRegex(source))
      expect(nfa.states).toEqual(nfa.states.map((_, k) => String(k)))
      const js = new RegExp(`^${toJs(ast)}$`)
      for (const s of strings) {
        expect(simulateENFA(nfa, s).accepted, `regex ${source}, input "${s.join('')}"`).toBe(js.test(s.join('')))
      }
    }
  }, 30_000)
})
