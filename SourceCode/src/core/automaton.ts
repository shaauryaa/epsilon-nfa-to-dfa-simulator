/**
 * Validation, text parsing/printing and JSON serialisation for ε-NFAs.
 */

import { EPSILON, type ENFA } from './types'

/** Machine-readable codes for problems that make an ε-NFA unusable. */
export type ErrorCode =
  | 'NO_STATES'
  | 'EMPTY_ALPHABET'
  | 'DUPLICATE_STATE'
  | 'DUPLICATE_SYMBOL'
  | 'NO_START'
  | 'START_NOT_A_STATE'
  | 'FINAL_NOT_A_STATE'
  | 'UNKNOWN_SOURCE_STATE'
  | 'UNKNOWN_TARGET_STATE'
  | 'UNKNOWN_SYMBOL'
  | 'EPSILON_IN_ALPHABET'
  | 'INVALID_NAME'

/** Machine-readable codes for suspicious but still valid ε-NFAs. */
export type WarningCode = 'NO_FINALS' | 'UNREACHABLE_STATE' | 'NO_EPSILON'

/** One validation finding. `state` / `symbol` point at the offending item. */
export interface Issue {
  code: ErrorCode | WarningCode
  message: string
  state?: string
  symbol?: string
}

/** Result of {@link validateENFA}. The machine is usable iff `errors` is empty. */
export interface ValidationResult {
  errors: Issue[]
  warnings: Issue[]
}

/** Thrown by {@link parseText} for a malformed line. `line` is 1-based. */
export class ParseError extends Error {
  readonly line: number
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`)
    this.name = 'ParseError'
    this.line = line
  }
}

/** Thrown by {@link fromJSON} when the JSON does not describe an ε-NFA. */
export class FormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormatError'
  }
}

/** Thrown by algorithms that require a valid ε-NFA when given an invalid one. */
export class InvalidAutomatonError extends Error {
  readonly issues: Issue[]
  constructor(issues: Issue[]) {
    super(`Invalid automaton: ${issues.map((i) => i.message).join('; ')}`)
    this.name = 'InvalidAutomatonError'
    this.issues = issues
  }
}

/** Current version written by {@link toJSON}. */
export const JSON_VERSION = 1

/** Words accepted by {@link parseText} as the ε keyword. */
export const EPSILON_KEYWORDS: readonly string[] = ['eps', 'epsilon', EPSILON, 'e']

const BAD_NAME = /[\s,]/

/**
 * Checks whether a string is usable as a state name or symbol.
 *
 * @param name - Candidate name.
 * @returns `true` if `name` is non-empty and contains no whitespace or commas.
 * @throws Never throws.
 */
export function isValidName(name: string): boolean {
  return typeof name === 'string' && name.length > 0 && !BAD_NAME.test(name)
}

/**
 * Validates the structure of an ε-NFA and reports every problem found.
 *
 * Errors make the machine unusable by the other algorithms; warnings describe
 * machines that are valid but probably not what the author intended.
 * Reachability (for `UNREACHABLE_STATE`) follows symbol and ε edges from the
 * start state and is only computed when the start state is valid.
 *
 * @param nfa - The automaton to check. It is not modified.
 * @returns All errors and warnings, in a stable order: states, alphabet,
 *   start, finals, transitions, then warnings.
 * @throws Never throws; malformed input is reported as issues.
 */
export function validateENFA(nfa: ENFA): ValidationResult {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const states = nfa.states ?? []
  const alphabet = nfa.alphabet ?? []
  const finals = nfa.finals ?? []
  const transitions = nfa.transitions ?? {}

  if (states.length === 0) errors.push({ code: 'NO_STATES', message: 'The automaton has no states.' })
  if (alphabet.length === 0) errors.push({ code: 'EMPTY_ALPHABET', message: 'The alphabet is empty.' })

  const stateSet = new Set<string>()
  for (const s of states) {
    if (!isValidName(s)) {
      errors.push({
        code: 'INVALID_NAME',
        message: `State name "${s}" is blank or contains whitespace or a comma.`,
        state: s,
      })
    }
    if (stateSet.has(s)) {
      errors.push({ code: 'DUPLICATE_STATE', message: `State "${s}" is declared more than once.`, state: s })
    }
    stateSet.add(s)
  }

  const symbolSet = new Set<string>()
  for (const a of alphabet) {
    if (a === EPSILON) {
      errors.push({
        code: 'EPSILON_IN_ALPHABET',
        message: `ε cannot be an alphabet symbol; it is reserved for empty moves.`,
        symbol: a,
      })
    } else if (!isValidName(a)) {
      errors.push({
        code: 'INVALID_NAME',
        message: `Symbol "${a}" is blank or contains whitespace or a comma.`,
        symbol: a,
      })
    }
    if (symbolSet.has(a)) {
      errors.push({ code: 'DUPLICATE_SYMBOL', message: `Symbol "${a}" is declared more than once.`, symbol: a })
    }
    symbolSet.add(a)
  }

  const startValid = typeof nfa.start === 'string' && nfa.start.length > 0
  if (!startValid) {
    errors.push({ code: 'NO_START', message: 'No start state is set.' })
  } else if (!stateSet.has(nfa.start)) {
    errors.push({
      code: 'START_NOT_A_STATE',
      message: `Start state "${nfa.start}" is not a declared state.`,
      state: nfa.start,
    })
  }

  for (const f of finals) {
    if (!stateSet.has(f)) {
      errors.push({ code: 'FINAL_NOT_A_STATE', message: `Final state "${f}" is not a declared state.`, state: f })
    }
  }

  let hasEpsilon = false
  for (const [src, row] of Object.entries(transitions)) {
    if (!stateSet.has(src)) {
      errors.push({
        code: 'UNKNOWN_SOURCE_STATE',
        message: `Transitions are given for "${src}", which is not a declared state.`,
        state: src,
      })
    }
    for (const [sym, targets] of Object.entries(row ?? {})) {
      if (sym === EPSILON) {
        if (targets.length > 0) hasEpsilon = true
      } else if (!symbolSet.has(sym)) {
        errors.push({
          code: 'UNKNOWN_SYMBOL',
          message: `Transition from "${src}" uses "${sym}", which is not in the alphabet.`,
          state: src,
          symbol: sym,
        })
      }
      for (const t of targets) {
        if (!stateSet.has(t)) {
          errors.push({
            code: 'UNKNOWN_TARGET_STATE',
            message: `Transition from "${src}" on "${sym}" goes to "${t}", which is not a declared state.`,
            state: t,
            symbol: sym,
          })
        }
      }
    }
  }

  if (finals.length === 0) {
    warnings.push({ code: 'NO_FINALS', message: 'There are no final states, so no string is accepted.' })
  }

  if (startValid && stateSet.has(nfa.start)) {
    const seen = new Set<string>([nfa.start])
    const stack = [nfa.start]
    while (stack.length > 0) {
      const s = stack.pop() as string
      for (const targets of Object.values(transitions[s] ?? {})) {
        for (const t of targets) {
          if (!seen.has(t)) {
            seen.add(t)
            stack.push(t)
          }
        }
      }
    }
    for (const s of stateSet) {
      if (!seen.has(s)) {
        warnings.push({
          code: 'UNREACHABLE_STATE',
          message: `State "${s}" cannot be reached from the start state.`,
          state: s,
        })
      }
    }
  }

  if (!hasEpsilon) {
    warnings.push({
      code: 'NO_EPSILON',
      message: 'The automaton has no ε-transitions; it is a plain NFA (still valid).',
    })
  }

  return { errors, warnings }
}

/**
 * Throws if an ε-NFA has validation errors.
 *
 * @param nfa - The automaton to check.
 * @returns Nothing.
 * @throws {InvalidAutomatonError} If {@link validateENFA} reports any error.
 */
export function assertValidENFA(nfa: ENFA): void {
  const { errors } = validateENFA(nfa)
  if (errors.length > 0) throw new InvalidAutomatonError(errors)
}

/**
 * Parses the line-based text format into an ε-NFA.
 *
 * Format (one item per line, `#` starts a comment, blank lines ignored):
 *
 * ```text
 * states: q0 q1 q2
 * alphabet: a b
 * start: q0
 * final: q2
 * q0 a -> q0 q1
 * q0 eps -> q1
 * ```
 *
 * Lists may be separated by spaces or commas. `finals:` is accepted as an
 * alias of `final:`. A transition line is `source symbol -> target...`;
 * several lines with the same source and symbol are merged. Header lines may
 * appear in any order, and the ε keyword is resolved after the whole text is
 * read: `eps`, `epsilon`, `ε` and `e` mean ε unless that word is itself
 * declared in the alphabet (so `e` can be an ordinary symbol).
 *
 * The parser checks syntax only. Use {@link validateENFA} for semantic checks
 * such as undeclared states.
 *
 * @param text - The source text.
 * @returns The parsed automaton. Missing headers give empty values.
 * @throws {ParseError} For an unknown header, a repeated header, a `start:`
 *   line without exactly one state, or a transition line that is not
 *   `source symbol -> target...`. The error carries the 1-based line number.
 */
export function parseText(text: string): ENFA {
  const nfa: ENFA = { states: [], alphabet: [], start: '', finals: [], transitions: {} }
  const seenHeaders = new Set<string>()
  const pending: { line: number; src: string; sym: string; targets: string[] }[] = []

  const lines = text.split(/\r\n|\r|\n/)
  lines.forEach((raw, i) => {
    const lineNo = i + 1
    const hash = raw.indexOf('#')
    const line = (hash >= 0 ? raw.slice(0, hash) : raw).trim()
    if (line === '') return

    const arrow = line.indexOf('->')
    if (arrow >= 0) {
      const left = line.slice(0, arrow).trim().split(/\s+/).filter(Boolean)
      const targets = splitList(line.slice(arrow + 2))
      if (left.length !== 2) {
        throw new ParseError(`expected "source symbol -> targets", found "${line}"`, lineNo)
      }
      if (targets.length === 0) throw new ParseError('a transition needs at least one target state', lineNo)
      pending.push({ line: lineNo, src: left[0], sym: left[1], targets })
      return
    }

    const colon = line.indexOf(':')
    if (colon < 0) throw new ParseError(`expected "key: values" or a transition, found "${line}"`, lineNo)
    let key = line.slice(0, colon).trim().toLowerCase()
    if (key === 'finals') key = 'final'
    const values = splitList(line.slice(colon + 1))
    if (!['states', 'alphabet', 'start', 'final'].includes(key)) {
      throw new ParseError(`unknown header "${line.slice(0, colon).trim()}"`, lineNo)
    }
    if (seenHeaders.has(key)) throw new ParseError(`"${key}:" appears more than once`, lineNo)
    seenHeaders.add(key)
    if (key === 'states') nfa.states = values
    else if (key === 'alphabet') nfa.alphabet = values
    else if (key === 'final') nfa.finals = values
    else {
      if (values.length !== 1) throw new ParseError('"start:" needs exactly one state', lineNo)
      nfa.start = values[0]
    }
  })

  const alphabet = new Set(nfa.alphabet)
  for (const t of pending) {
    const sym = EPSILON_KEYWORDS.includes(t.sym) && !alphabet.has(t.sym) ? EPSILON : t.sym
    const row = (nfa.transitions[t.src] ??= {})
    const list = (row[sym] ??= [])
    for (const target of t.targets) if (!list.includes(target)) list.push(target)
  }
  return nfa
}

function splitList(s: string): string[] {
  return s.split(/[\s,]+/).filter(Boolean)
}

/**
 * Prints an ε-NFA in the text format read by {@link parseText}.
 *
 * Transitions are written per source state in declaration order, symbols in
 * alphabet order followed by ε, then any undeclared keys so nothing is lost.
 * ε is written as `eps`, or as `ε` if `eps` is an alphabet symbol. Empty
 * target lists are omitted. `parseText(toText(nfa))` reproduces `nfa` for any
 * automaton whose names are valid.
 *
 * @param nfa - The automaton to print.
 * @returns The text, ending with a newline.
 * @throws Never throws.
 */
export function toText(nfa: ENFA): string {
  const eps = nfa.alphabet.includes('eps') ? EPSILON : 'eps'
  const out = [
    `states: ${nfa.states.join(' ')}`,
    `alphabet: ${nfa.alphabet.join(' ')}`,
    `start: ${nfa.start}`,
    `final: ${nfa.finals.join(' ')}`,
  ]
  const sources = [...nfa.states, ...Object.keys(nfa.transitions).filter((s) => !nfa.states.includes(s))]
  for (const src of sources) {
    const row = nfa.transitions[src]
    if (!row) continue
    const symbols = [...nfa.alphabet, EPSILON, ...Object.keys(row).filter((k) => k !== EPSILON && !nfa.alphabet.includes(k))]
    for (const sym of symbols) {
      const targets = row[sym]
      if (!targets || targets.length === 0) continue
      out.push(`${src} ${sym === EPSILON ? eps : sym} -> ${targets.join(' ')}`)
    }
  }
  return out.join('\n') + '\n'
}

/**
 * Serialises an ε-NFA to JSON with a format marker and version number.
 *
 * Output shape: `{ format: "enfa", version: 1, states, alphabet, start,
 * finals, transitions }`.
 *
 * @param nfa - The automaton to serialise.
 * @param indent - Indentation passed to `JSON.stringify` (default 2).
 * @returns The JSON text.
 * @throws Never throws for a plain-data ENFA.
 */
export function toJSON(nfa: ENFA, indent = 2): string {
  const { states, alphabet, start, finals, transitions } = nfa
  return JSON.stringify({ format: 'enfa', version: JSON_VERSION, states, alphabet, start, finals, transitions }, null, indent)
}

/**
 * Reads an ε-NFA written by {@link toJSON}.
 *
 * Unknown top-level keys (for example preset metadata) are ignored. The shape
 * is checked; the automaton itself is not validated — call
 * {@link validateENFA} for that.
 *
 * @param json - JSON text.
 * @returns A fresh ENFA object.
 * @throws {FormatError} If the text is not JSON, `version` is missing or
 *   unsupported, or a field has the wrong type.
 */
export function fromJSON(json: string): ENFA {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (e) {
    throw new FormatError(`Not valid JSON: ${(e as Error).message}`)
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new FormatError('Expected a JSON object.')
  }
  const o = data as Record<string, unknown>
  if (o.version === undefined) throw new FormatError('Missing "version" field.')
  if (o.version !== JSON_VERSION) throw new FormatError(`Unsupported version ${String(o.version)}; expected ${JSON_VERSION}.`)
  const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
  if (!isStrings(o.states)) throw new FormatError('"states" must be an array of strings.')
  if (!isStrings(o.alphabet)) throw new FormatError('"alphabet" must be an array of strings.')
  if (typeof o.start !== 'string') throw new FormatError('"start" must be a string.')
  if (!isStrings(o.finals)) throw new FormatError('"finals" must be an array of strings.')
  if (typeof o.transitions !== 'object' || o.transitions === null || Array.isArray(o.transitions)) {
    throw new FormatError('"transitions" must be an object.')
  }
  const transitions: ENFA['transitions'] = {}
  for (const [src, row] of Object.entries(o.transitions as Record<string, unknown>)) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new FormatError(`"transitions.${src}" must be an object.`)
    }
    transitions[src] = {}
    for (const [sym, targets] of Object.entries(row as Record<string, unknown>)) {
      if (!isStrings(targets)) throw new FormatError(`"transitions.${src}.${sym}" must be an array of strings.`)
      transitions[src][sym] = [...targets]
    }
  }
  return { states: [...o.states], alphabet: [...o.alphabet], start: o.start, finals: [...o.finals], transitions }
}
