/**
 * Regular expressions: a recursive-descent parser and Thompson's
 * construction from a regex to an ε-NFA.
 *
 * Syntax (whitespace is ignored):
 * - symbols: one lowercase letter `a`–`z` or digit `0`–`9`
 * - ε: `ε` or the keyword `eps` (so `eps` is never read as e·p·s)
 * - union: `|` or `+`
 * - concatenation: writing two expressions next to each other
 * - postfix: `*` (Kleene star) and `?` (zero or one)
 * - grouping: `(` … `)`
 *
 * Precedence, highest first: `*` `?` > concatenation > union. Union and
 * concatenation are left-associative.
 */

import { EPSILON, type ENFA } from './types'

/** Abstract syntax tree of a parsed regular expression. */
export type RegexNode =
  | { kind: 'symbol'; symbol: string }
  | { kind: 'epsilon' }
  | { kind: 'union'; left: RegexNode; right: RegexNode }
  | { kind: 'concat'; left: RegexNode; right: RegexNode }
  | { kind: 'star'; inner: RegexNode }
  | { kind: 'optional'; inner: RegexNode }

/** Thrown by {@link parseRegex} for malformed input. */
export class RegexSyntaxError extends Error {
  /** 1-based character position (in code points) where the problem was found. */
  readonly position: number
  constructor(message: string, position: number) {
    super(message)
    this.name = 'RegexSyntaxError'
    this.position = position
  }
}

type TokenKind = 'symbol' | 'epsilon' | 'union' | 'star' | 'optional' | 'lparen' | 'rparen' | 'end'
interface Token {
  kind: TokenKind
  text: string
  /** 1-based position of the token's first character. */
  pos: number
}

function lex(source: string): Token[] {
  const chars = [...source]
  const tokens: Token[] = []
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const pos = i + 1
    if (/\s/.test(ch)) continue
    if (ch === 'e' && chars[i + 1] === 'p' && chars[i + 2] === 's') {
      tokens.push({ kind: 'epsilon', text: 'eps', pos })
      i += 2
    } else if (/^[a-z0-9]$/.test(ch)) tokens.push({ kind: 'symbol', text: ch, pos })
    else if (ch === EPSILON) tokens.push({ kind: 'epsilon', text: ch, pos })
    else if (ch === '|' || ch === '+') tokens.push({ kind: 'union', text: ch, pos })
    else if (ch === '*') tokens.push({ kind: 'star', text: ch, pos })
    else if (ch === '?') tokens.push({ kind: 'optional', text: ch, pos })
    else if (ch === '(') tokens.push({ kind: 'lparen', text: ch, pos })
    else if (ch === ')') tokens.push({ kind: 'rparen', text: ch, pos })
    else throw new RegexSyntaxError(`"${ch}" is not allowed. Use a–z, 0–9, |, +, *, ?, ( ) and ε or eps.`, pos)
  }
  tokens.push({ kind: 'end', text: '', pos: chars.length + 1 })
  return tokens
}

/**
 * Parses a regular expression into an AST by recursive descent.
 *
 * Grammar:
 * ```
 * union   := concat (('|' | '+') concat)*
 * concat  := postfix postfix*
 * postfix := atom ('*' | '?')*
 * atom    := symbol | 'ε' | 'eps' | '(' union ')'
 * ```
 *
 * @param source - The regex text, e.g. `(a|b)*abb`.
 * @returns The AST. Binary nodes are left-associative.
 * @throws {RegexSyntaxError} For an empty regex, a character outside the
 *   syntax, a missing operand (`a|`, `*a`, `()`), or unbalanced parentheses.
 *   `position` is 1-based.
 */
export function parseRegex(source: string): RegexNode {
  const tokens = lex(source)
  let i = 0
  const peek = () => tokens[i]

  const startsAtom = (t: Token) => t.kind === 'symbol' || t.kind === 'epsilon' || t.kind === 'lparen'

  const missingOperand = (t: Token): never => {
    if (t.kind === 'end') throw new RegexSyntaxError(i === 0 ? 'The regular expression is empty.' : 'Expected a symbol, ε or "(" at the end.', t.pos)
    if (t.kind === 'rparen') throw new RegexSyntaxError('Expected a symbol, ε or "(" before ")".', t.pos)
    throw new RegexSyntaxError(`"${t.text}" needs an expression before it.`, t.pos)
  }

  function union(): RegexNode {
    let node = concat()
    while (peek().kind === 'union') {
      i++
      node = { kind: 'union', left: node, right: concat() }
    }
    return node
  }

  function concat(): RegexNode {
    if (!startsAtom(peek())) missingOperand(peek())
    let node = postfix()
    while (startsAtom(peek())) node = { kind: 'concat', left: node, right: postfix() }
    return node
  }

  function postfix(): RegexNode {
    let node = atom()
    for (;;) {
      const k = peek().kind
      if (k === 'star') node = { kind: 'star', inner: node }
      else if (k === 'optional') node = { kind: 'optional', inner: node }
      else return node
      i++
    }
  }

  function atom(): RegexNode {
    const t = tokens[i++]
    if (t.kind === 'symbol') return { kind: 'symbol', symbol: t.text }
    if (t.kind === 'epsilon') return { kind: 'epsilon' }
    // startsAtom guarantees a "(" here.
    const inner = union()
    const close = peek()
    if (close.kind !== 'rparen') throw new RegexSyntaxError(`Missing ")" for the "(" at position ${t.pos}.`, close.pos)
    i++
    return inner
  }

  const tree = union()
  const rest = peek()
  if (rest.kind === 'rparen') throw new RegexSyntaxError('This ")" has no matching "(".', rest.pos)
  if (rest.kind !== 'end') missingOperand(rest)
  return tree
}

/**
 * Builds an ε-NFA from a regex AST with Thompson's construction, in the form
 * used by Aho, Lam, Sethi and Ullman (Compilers, §3.7.4):
 *
 * - symbol a: `i --a--> f`; ε: `i --ε--> f`
 * - union s|t: new `i` with ε to both starts, both ends ε to a new `f`
 * - concatenation st: the end of N(s) *is* the start of N(t) (merged)
 * - star s*: new `i` and `f`; `i` ε→ start(s), `i` ε→ `f`,
 *   end(s) ε→ start(s), end(s) ε→ `f`
 * - optional s?: as star without the loop back
 *
 * Every fragment has a start with no incoming edges and an end with no
 * outgoing edges, which is what makes the merge in concatenation safe.
 *
 * States are named `0` … `n-1` in the order they are created (start before
 * the operands, end after them), so `(a|b)*abb` gives the textbook machine
 * with states 0–10. The result has exactly one final state.
 *
 * @param ast - A tree from {@link parseRegex}.
 * @returns The ε-NFA. Its alphabet is the symbols used, sorted (`0`–`9`
 *   before `a`–`z`); it is empty when the regex has no symbols, which
 *   `validateENFA` reports as an error.
 * @throws Never throws.
 */
export function thompson(ast: RegexNode): ENFA {
  let count = 0
  const transitions: ENFA['transitions'] = {}
  const symbols = new Set<string>()
  const fresh = () => String(count++)
  const edge = (from: string, symbol: string, to: string) => {
    ;((transitions[from] ??= {})[symbol] ??= []).push(to)
  }

  /** Builds `node`; `start` reuses an existing state as the fragment's start. */
  function build(node: RegexNode, start?: string): { start: string; end: string } {
    switch (node.kind) {
      case 'symbol':
      case 'epsilon': {
        const i = start ?? fresh()
        const f = fresh()
        if (node.kind === 'symbol') symbols.add(node.symbol)
        edge(i, node.kind === 'symbol' ? node.symbol : EPSILON, f)
        return { start: i, end: f }
      }
      case 'concat': {
        const left = build(node.left, start)
        const right = build(node.right, left.end)
        return { start: left.start, end: right.end }
      }
      case 'union': {
        const i = start ?? fresh()
        const l = build(node.left)
        const r = build(node.right)
        const f = fresh()
        edge(i, EPSILON, l.start)
        edge(i, EPSILON, r.start)
        edge(l.end, EPSILON, f)
        edge(r.end, EPSILON, f)
        return { start: i, end: f }
      }
      case 'star':
      case 'optional': {
        const i = start ?? fresh()
        const s = build(node.inner)
        const f = fresh()
        edge(i, EPSILON, s.start)
        edge(i, EPSILON, f)
        if (node.kind === 'star') edge(s.end, EPSILON, s.start)
        edge(s.end, EPSILON, f)
        return { start: i, end: f }
      }
    }
  }

  const { start, end } = build(ast)
  // Sort each ε list so the order does not depend on construction details.
  for (const row of Object.values(transitions)) {
    if (row[EPSILON]) row[EPSILON].sort((a, b) => Number(a) - Number(b))
  }
  return {
    states: Array.from({ length: count }, (_, k) => String(k)),
    alphabet: [...symbols].sort(),
    start,
    finals: [end],
    transitions,
  }
}

/**
 * Parses a regex and builds its Thompson ε-NFA in one call.
 *
 * @param source - The regex text.
 * @returns The ε-NFA from {@link thompson}.
 * @throws {RegexSyntaxError} See {@link parseRegex}.
 */
export function regexToENFA(source: string): ENFA {
  return thompson(parseRegex(source))
}
