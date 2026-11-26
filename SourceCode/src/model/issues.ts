/**
 * Maps validation issues to the editor element that should receive focus
 * when the user clicks the issue.
 */

import type { ENFA, Issue } from '../core'

/** Where to send focus for an issue. Row indexes are 0-based table rows. */
export type FocusTarget =
  | { kind: 'state'; row: number }
  | { kind: 'start'; row: number }
  | { kind: 'final'; row: number }
  | { kind: 'cell'; row: number; symbol: string }
  | { kind: 'symbol'; symbol: string }
  | { kind: 'epsilon' }
  | { kind: 'add-state' }
  | { kind: 'add-symbol' }
  | { kind: 'text'; line: number }

/**
 * Returns the `data-focus` key of the table element a focus target points
 * at. Text targets have no table element and return `text`.
 *
 * @param t - The focus target.
 * @returns The key, e.g. `cell:2:a`, `state:0` or `eps`.
 * @throws Never throws.
 */
export function focusKey(t: FocusTarget): string {
  switch (t.kind) {
    case 'state':
    case 'start':
    case 'final':
      return `${t.kind}:${t.row}`
    case 'cell':
      return `cell:${t.row}:${t.symbol}`
    case 'symbol':
      return `symbol:${t.symbol}`
    case 'epsilon':
      return 'eps'
    default:
      return t.kind
  }
}

/**
 * Finds the 1-based line of the text editor content that best matches an
 * issue which has no table cell (undeclared sources, symbols or finals).
 *
 * @param text - The text editor content.
 * @param test - Predicate on a line with comments stripped and trimmed.
 * @returns The first matching line, or 1 if none matches.
 * @throws Never throws.
 */
export function findLine(text: string, test: (line: string) => boolean): number {
  const lines = text.split(/\r\n|\r|\n/)
  const i = lines.findIndex((raw) => test(raw.replace(/#.*$/, '').trim()))
  return i >= 0 ? i + 1 : 1
}

/**
 * Decides which editor element an issue refers to.
 *
 * @param issue - A finding from `validateENFA`.
 * @param nfa - The automaton that was validated.
 * @param text - The current text editor content, for issues that only exist
 *   in text form.
 * @returns The focus target.
 * @throws Never throws.
 */
export function focusTargetFor(issue: Issue, nfa: ENFA, text: string): FocusTarget {
  const row = (s: string | undefined) => Math.max(0, s === undefined ? 0 : nfa.states.indexOf(s))
  const words = (line: string) => line.split(/[\s,:]+/).filter(Boolean)
  switch (issue.code) {
    case 'NO_STATES':
      return { kind: 'add-state' }
    case 'EMPTY_ALPHABET':
      return { kind: 'add-symbol' }
    case 'DUPLICATE_STATE':
    case 'UNREACHABLE_STATE':
      return { kind: 'state', row: row(issue.state) }
    case 'INVALID_NAME':
      return issue.symbol !== undefined ? { kind: 'symbol', symbol: issue.symbol } : { kind: 'state', row: row(issue.state) }
    case 'DUPLICATE_SYMBOL':
    case 'EPSILON_IN_ALPHABET':
      return { kind: 'symbol', symbol: issue.symbol ?? '' }
    case 'NO_START':
    case 'START_NOT_A_STATE':
      return { kind: 'start', row: 0 }
    case 'NO_FINALS':
      return { kind: 'final', row: 0 }
    case 'NO_EPSILON':
      return { kind: 'epsilon' }
    case 'UNKNOWN_TARGET_STATE': {
      for (const [r, s] of nfa.states.entries()) {
        const targets = nfa.transitions[s]?.[issue.symbol ?? '']
        if (targets?.includes(issue.state ?? '')) return { kind: 'cell', row: r, symbol: issue.symbol ?? '' }
      }
      return { kind: 'text', line: findLine(text, (l) => l.includes('->') && words(l.split('->')[1]).includes(issue.state ?? '')) }
    }
    case 'FINAL_NOT_A_STATE':
      return { kind: 'text', line: findLine(text, (l) => /^finals?\s*:/i.test(l)) }
    case 'UNKNOWN_SOURCE_STATE':
      return { kind: 'text', line: findLine(text, (l) => l.includes('->') && words(l)[0] === issue.state) }
    case 'UNKNOWN_SYMBOL':
      return {
        kind: 'text',
        line: findLine(text, (l) => l.includes('->') && words(l)[0] === issue.state && words(l)[1] === issue.symbol),
      }
  }
}
