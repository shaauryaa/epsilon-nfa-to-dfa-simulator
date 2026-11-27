/**
 * Immutable editing operations on an ε-NFA, used by the editors.
 *
 * These only reshape data (add, rename, delete); they contain no automata
 * algorithms. Every function returns a new ENFA and never mutates its input.
 * Validation stays in `validateENFA`: these helpers happily produce invalid
 * machines (for example a missing start state) so the validator can explain
 * the problem to the user.
 */

import { EPSILON, isReservedName, type ENFA } from '../core'

/**
 * Words the "Add transition" form reads as ε. Deliberately only `ε` and
 * `eps`: a typed `e` is an ordinary new symbol here, never silently ε. (The
 * text format keeps its documented keywords, see `parseText`.)
 */
export const FORM_EPSILON_WORDS: readonly string[] = [EPSILON, 'eps']

/**
 * Returns a deep copy of an ε-NFA.
 *
 * @param nfa - The automaton to copy.
 * @returns A copy sharing no arrays or objects with `nfa`.
 * @throws Never throws.
 */
export function cloneENFA(nfa: ENFA): ENFA {
  const transitions: ENFA['transitions'] = {}
  for (const [src, row] of Object.entries(nfa.transitions)) {
    transitions[src] = {}
    for (const [sym, targets] of Object.entries(row)) transitions[src][sym] = [...targets]
  }
  return { states: [...nfa.states], alphabet: [...nfa.alphabet], start: nfa.start, finals: [...nfa.finals], transitions }
}

/**
 * Creates the machine used by "New blank machine": one start state `q0`,
 * alphabet `{a}`, no transitions and no final states.
 *
 * @returns A fresh blank ε-NFA.
 * @throws Never throws.
 */
export function blankENFA(): ENFA {
  return { states: ['q0'], alphabet: ['a'], start: 'q0', finals: [], transitions: {} }
}

/**
 * Picks a name for a new state that follows the machine's naming style:
 * the next number for purely numeric names (`0`…`10` → `11`), the next index
 * for a shared prefix (`q0`, `q1` → `q2`), otherwise `q0`, `q1`, ….
 *
 * @param states - Existing state names.
 * @returns A valid name not in `states`.
 * @throws Never throws.
 */
export function nextStateName(states: readonly string[]): string {
  const taken = new Set(states)
  if (states.length > 0 && states.every((s) => /^\d+$/.test(s))) {
    let n = Math.max(...states.map(Number)) + 1
    while (taken.has(String(n))) n++
    return String(n)
  }
  const prefixes = new Map<string, number>()
  for (const s of states) {
    const m = /^(.*?)(\d+)$/.exec(s)
    if (m && m[1] !== '') prefixes.set(m[1], Math.max(prefixes.get(m[1]) ?? -1, Number(m[2])))
  }
  const [prefix, max] = [...prefixes.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['q', -1]
  let n = max + 1
  while (taken.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

/**
 * Picks a name for a new alphabet symbol: the first unused letter `a`–`z`,
 * then digits `0`–`9`, then `s1`, `s2`, ….
 *
 * @param alphabet - Existing symbols.
 * @returns A valid symbol not in `alphabet` and not ε or an ε keyword.
 * @throws Never throws.
 */
export function nextSymbolName(alphabet: readonly string[]): string {
  const taken = new Set(alphabet)
  for (const c of 'abcdfghijklmnopqrstuvwxyz0123456789') if (!taken.has(c)) return c
  let n = 1
  while (taken.has(`s${n}`)) n++
  return `s${n}`
}

/**
 * Splits a table cell such as `q1, q2` into target names.
 *
 * @param raw - Cell text; names are separated by commas and/or whitespace.
 * @returns The names in order, without blanks or repeats.
 * @throws Never throws.
 */
export function parseTargets(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))]
}

/**
 * Appends a new state.
 *
 * @param nfa - The automaton.
 * @param name - Name to use; defaults to {@link nextStateName}.
 * @returns The new automaton and the name that was added.
 * @throws Never throws.
 */
export function addState(nfa: ENFA, name = nextStateName(nfa.states)): { nfa: ENFA; name: string } {
  const out = cloneENFA(nfa)
  out.states.push(name)
  if (out.start === '' && out.states.length === 1) out.start = name
  return { nfa: out, name }
}

/**
 * Renames a state everywhere it appears: the state list, start, finals,
 * transition sources and transition targets.
 *
 * @param nfa - The automaton.
 * @param from - Current name.
 * @param to - New name. The caller checks it is valid and unused.
 * @returns The renamed automaton (unchanged copy if `from === to`).
 * @throws Never throws.
 */
export function renameState(nfa: ENFA, from: string, to: string): ENFA {
  const out = cloneENFA(nfa)
  if (from === to) return out
  const swap = (s: string) => (s === from ? to : s)
  out.states = out.states.map(swap)
  out.start = swap(out.start)
  out.finals = out.finals.map(swap)
  const transitions: ENFA['transitions'] = {}
  for (const [src, row] of Object.entries(out.transitions)) {
    const newRow: Record<string, string[]> = {}
    for (const [sym, targets] of Object.entries(row)) newRow[sym] = targets.map(swap)
    transitions[swap(src)] = newRow
  }
  out.transitions = transitions
  return out
}

/**
 * Deletes a state and every transition into or out of it. If it was the
 * start state the start is cleared (the validator then reports it).
 *
 * @param nfa - The automaton.
 * @param name - State to delete.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function deleteState(nfa: ENFA, name: string): ENFA {
  const out = cloneENFA(nfa)
  out.states = out.states.filter((s) => s !== name)
  out.finals = out.finals.filter((s) => s !== name)
  if (out.start === name) out.start = ''
  delete out.transitions[name]
  for (const row of Object.values(out.transitions)) {
    for (const sym of Object.keys(row)) {
      row[sym] = row[sym].filter((t) => t !== name)
      if (row[sym].length === 0) delete row[sym]
    }
  }
  return pruneEmptyRows(out)
}

/**
 * Appends a new alphabet symbol.
 *
 * @param nfa - The automaton.
 * @param symbol - Symbol to add; defaults to {@link nextSymbolName}.
 * @returns The new automaton and the symbol that was added.
 * @throws Never throws.
 */
export function addSymbol(nfa: ENFA, symbol = nextSymbolName(nfa.alphabet)): { nfa: ENFA; symbol: string } {
  const out = cloneENFA(nfa)
  out.alphabet.push(symbol)
  return { nfa: out, symbol }
}

/**
 * Renames an alphabet symbol in the alphabet and in every transition.
 *
 * @param nfa - The automaton.
 * @param from - Current symbol.
 * @param to - New symbol. The caller checks it is valid, unused and not ε.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function renameSymbol(nfa: ENFA, from: string, to: string): ENFA {
  const out = cloneENFA(nfa)
  if (from === to) return out
  out.alphabet = out.alphabet.map((a) => (a === from ? to : a))
  for (const [src, row] of Object.entries(out.transitions)) {
    const newRow: Record<string, string[]> = {}
    for (const [sym, targets] of Object.entries(row)) newRow[sym === from ? to : sym] = targets
    out.transitions[src] = newRow
  }
  return out
}

/**
 * Deletes an alphabet symbol and every transition on it.
 *
 * @param nfa - The automaton.
 * @param symbol - Symbol to delete.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function deleteSymbol(nfa: ENFA, symbol: string): ENFA {
  const out = cloneENFA(nfa)
  out.alphabet = out.alphabet.filter((a) => a !== symbol)
  for (const row of Object.values(out.transitions)) delete row[symbol]
  return pruneEmptyRows(out)
}

/**
 * Replaces the targets of one (state, symbol) cell. An empty list removes
 * the entry.
 *
 * @param nfa - The automaton.
 * @param state - Source state.
 * @param symbol - Alphabet symbol or {@link EPSILON}.
 * @param targets - New target list (kept in the given order).
 * @returns The new automaton.
 * @throws Never throws.
 */
export function setTargets(nfa: ENFA, state: string, symbol: string, targets: readonly string[]): ENFA {
  const out = cloneENFA(nfa)
  const row = (out.transitions[state] ??= {})
  if (targets.length === 0) delete row[symbol]
  else row[symbol] = [...targets]
  return pruneEmptyRows(out)
}

/**
 * Adds a single transition if it is not already present.
 *
 * @param nfa - The automaton.
 * @param from - Source state.
 * @param symbol - Alphabet symbol or {@link EPSILON}.
 * @param to - Target state.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function addTransition(nfa: ENFA, from: string, symbol: string, to: string): ENFA {
  const current = nfa.transitions[from]?.[symbol] ?? []
  return current.includes(to) ? cloneENFA(nfa) : setTargets(nfa, from, symbol, [...current, to])
}

/**
 * Sets the start state.
 *
 * @param nfa - The automaton.
 * @param state - The new start state.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function setStart(nfa: ENFA, state: string): ENFA {
  return { ...cloneENFA(nfa), start: state }
}

/**
 * Marks or unmarks a state as final, keeping finals in declaration order.
 *
 * @param nfa - The automaton.
 * @param state - The state.
 * @param final - Whether it should be final.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function setFinal(nfa: ENFA, state: string, final: boolean): ENFA {
  const out = cloneENFA(nfa)
  const set = new Set(out.finals.filter((f) => f !== state))
  if (final) set.add(state)
  const declared = out.states.filter((s) => set.has(s))
  const undeclared = [...set].filter((s) => !out.states.includes(s))
  out.finals = [...declared, ...undeclared]
  return out
}

/**
 * Checks a proposed state or symbol name for the rename and add forms.
 *
 * @param name - Proposed name.
 * @param taken - Names already in use (excluding the item being renamed).
 * @param kind - `state` or `symbol`; symbols may not be ε.
 * @returns An error message, or `null` if the name is acceptable.
 * @throws Never throws.
 */
export function checkName(name: string, taken: readonly string[], kind: 'state' | 'symbol'): string | null {
  if (name.length === 0) return 'Enter a name.'
  if (/[\s,]/.test(name)) return 'Names cannot contain spaces or commas.'
  if (kind === 'symbol' && name === EPSILON) return 'ε is reserved for empty moves.'
  if (kind === 'symbol' && FORM_EPSILON_WORDS.includes(name)) return `"${name}" is how ε is typed in the transition form; pick another symbol.`
  if (isReservedName(name)) return `"${name}" is a reserved word; pick another name.`
  if (taken.includes(name)) return kind === 'state' ? `“${name}” is already a state.` : `“${name}” is already a symbol.`
  return null
}

/**
 * Removes one transition `from --symbol--> to`, if present.
 *
 * @param nfa - The automaton.
 * @param from - Source state.
 * @param symbol - Alphabet symbol or {@link EPSILON}.
 * @param to - Target state to remove from that cell.
 * @returns The new automaton (an unchanged copy if the transition is absent).
 * @throws Never throws.
 */
export function removeTransition(nfa: ENFA, from: string, symbol: string, to: string): ENFA {
  const current = nfa.transitions[from]?.[symbol] ?? []
  if (!current.includes(to)) return cloneENFA(nfa)
  return setTargets(
    nfa,
    from,
    symbol,
    current.filter((t) => t !== to),
  )
}

/**
 * Adds `to` to the cell δ(from, symbol) if it is missing, otherwise removes
 * it. New targets are kept in state declaration order so the table reads
 * naturally; targets that are not declared states stay at the end.
 *
 * @param nfa - The automaton.
 * @param from - Source state.
 * @param symbol - Alphabet symbol or {@link EPSILON}.
 * @param to - Target state to toggle.
 * @returns The new automaton.
 * @throws Never throws.
 */
export function toggleTarget(nfa: ENFA, from: string, symbol: string, to: string): ENFA {
  const current = nfa.transitions[from]?.[symbol] ?? []
  if (current.includes(to)) return removeTransition(nfa, from, symbol, to)
  const next = new Set([...current, to])
  const declared = nfa.states.filter((s) => next.has(s))
  const undeclared = [...next].filter((s) => !nfa.states.includes(s))
  return setTargets(nfa, from, symbol, [...declared, ...undeclared])
}

/**
 * Reads the symbol field of the "Add transition" form. Several symbols may
 * be separated by commas or spaces (`a,b`). Only `ε` and `eps` mean ε
 * ({@link FORM_EPSILON_WORDS}), and `eps` only while it is not an alphabet
 * symbol. Every other word, including `e`, is a symbol.
 *
 * @param raw - What the user typed.
 * @param alphabet - The current alphabet.
 * @returns The symbols in order without repeats; ε is returned as {@link EPSILON}.
 * @throws Never throws.
 */
export function parseSymbols(raw: string, alphabet: readonly string[]): string[] {
  const out = raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => (w === EPSILON || (FORM_EPSILON_WORDS.includes(w) && !alphabet.includes(w)) ? EPSILON : w))
  return [...new Set(out)]
}

/**
 * Writes a cell's targets as a set in textbook notation: `{1, 7}`, or `∅`
 * when there are none.
 *
 * @param targets - Target state names.
 * @returns The formatted set.
 * @throws Never throws.
 */
export function formatTargets(targets: readonly string[] | undefined): string {
  return !targets || targets.length === 0 ? '∅' : `{${targets.join(', ')}}`
}

function pruneEmptyRows(nfa: ENFA): ENFA {
  for (const [src, row] of Object.entries(nfa.transitions)) {
    if (Object.keys(row).length === 0) delete nfa.transitions[src]
  }
  return nfa
}
