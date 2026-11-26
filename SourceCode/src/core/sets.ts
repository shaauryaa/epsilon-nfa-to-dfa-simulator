/**
 * Small helpers for working with sets of state names while keeping a stable,
 * declaration-based order.
 */

/**
 * Builds a lookup from state name to its position in a declared state list.
 *
 * @param states - The declared states, in declaration order.
 * @returns A map from each state name to its index. If a name appears twice,
 *   the first index wins.
 * @throws Never throws.
 */
export function indexOrder(states: readonly string[]): Map<string, number> {
  const order = new Map<string, number>()
  states.forEach((s, i) => {
    if (!order.has(s)) order.set(s, i)
  })
  return order
}

/**
 * Removes duplicates from a collection of state names and sorts it by
 * declaration order.
 *
 * Names missing from `order` (undeclared states) are placed after all declared
 * ones, sorted by plain string comparison, so the result is still
 * deterministic for malformed input.
 *
 * @param order - Declaration-order lookup from {@link indexOrder}.
 * @param states - The names to sort; may contain duplicates.
 * @returns A new, duplicate-free, sorted array.
 * @throws Never throws.
 */
export function sortByOrder(order: ReadonlyMap<string, number>, states: Iterable<string>): string[] {
  const unique = [...new Set(states)]
  return unique.sort((a, b) => {
    const ia = order.get(a)
    const ib = order.get(b)
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined) return -1
    if (ib !== undefined) return 1
    return a < b ? -1 : a > b ? 1 : 0
  })
}

/**
 * Formats a set of state names in textbook notation, e.g. `{0,1,2}`.
 *
 * @param states - The (already ordered) state names.
 * @returns `{a,b,c}` for a non-empty set, `∅` for the empty set.
 * @throws Never throws.
 */
export function formatSet(states: readonly string[]): string {
  return states.length === 0 ? '∅' : `{${states.join(',')}}`
}
