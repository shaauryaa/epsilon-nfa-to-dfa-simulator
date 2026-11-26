/**
 * Everything the app derives from the current ε-NFA, computed only through
 * the core algorithms.
 */

import {
  closureTable,
  minimizeDFA,
  subsetConstruction,
  validateENFA,
  type ENFA,
  type MinimizeResult,
  type SubsetResult,
  type ValidationResult,
} from '../core'

/** Results derived from one ε-NFA. Algorithm results are `null` while the machine has errors. */
export interface Derived {
  validation: ValidationResult
  closures: Record<string, string[]> | null
  subset: SubsetResult | null
  minimized: MinimizeResult | null
  /** Message if an algorithm threw unexpectedly (should not happen for a valid machine). */
  error: string | null
}

/**
 * Validates an ε-NFA and, if it has no errors, runs ε-closure, subset
 * construction and minimisation on it.
 *
 * @param nfa - The automaton.
 * @returns The validation result and every derived result.
 * @throws Never throws; unexpected algorithm failures are returned in `error`.
 */
export function derive(nfa: ENFA): Derived {
  const validation = validateENFA(nfa)
  if (validation.errors.length > 0) return { validation, closures: null, subset: null, minimized: null, error: null }
  try {
    const closures = closureTable(nfa)
    const subset = subsetConstruction(nfa)
    const minimized = minimizeDFA(subset.dfa)
    return { validation, closures, subset, minimized, error: null }
  } catch (e) {
    return { validation, closures: null, subset: null, minimized: null, error: (e as Error).message }
  }
}
