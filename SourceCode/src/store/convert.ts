/**
 * Convert-mode state: which subset-construction step and micro-step (frame)
 * is shown, playback, speed, the Instant and dead-state toggles, and the
 * ε-closure row picked in the closure table.
 */

import { create } from 'zustand'
import { subsetConstruction, type ENFA, type SubsetResult } from '../core'
import { planAll, type Frame } from '../model/convertPlan'
import { playerSlice, type PlayerState } from './player'
import { isTooLargeToDraw } from '../model/largeDfa'

/** A conversion ready to play: the result and its animation plan. */
export interface Conversion {
  result: SubsetResult
  /** Frames per step; empty when {@link Conversion.large} (nothing is animated). */
  plan: Frame[][]
  /** True when the DFA is too large to draw: only tables and stats are shown. */
  large: boolean
}

let cache: { nfa: ENFA; subset: SubsetResult; showDead: boolean; value: Conversion } | null = null

/**
 * Returns the conversion to show for a machine. With the dead state on it
 * reuses the store's derived result; with it off it re-runs subset
 * construction without the dead state. Cached per machine.
 *
 * @param nfa - The current machine.
 * @param subset - The derived result (with dead state), or `null` while the machine has errors.
 * @param showDead - Whether the dead state ∅ is shown.
 * @returns The conversion, or `null` when there is nothing to convert.
 *   Conversions with more than `MAX_DRAWN_DFA_STATES` states have `large`
 *   set and an empty plan.
 */
export function getConversion(nfa: ENFA, subset: SubsetResult | null, showDead: boolean): Conversion | null {
  if (!subset) return null
  if (cache && cache.nfa === nfa && cache.subset === subset && cache.showDead === showDead) return cache.value
  const result = showDead ? subset : subsetConstruction(nfa, { includeDeadState: false })
  // Large DFAs are never animated, so the per-step plan is not built.
  const large = isTooLargeToDraw(result.dfa.states.length)
  const value = { result, plan: large ? [] : planAll(nfa, result), large }
  cache = { nfa, subset, showDead, value }
  return value
}

export { INSTANT_STEP_MS, frameDelay } from './player'

export interface ConvertState extends PlayerState {
  showDead: boolean
  pickedClosure: string | null
  setShowDead: (on: boolean) => void
  pickClosure: (state: string | null) => void
}

export const useConvert = create<ConvertState>((set, get) => ({
  ...playerSlice<ConvertState>(set, get, { pickedClosure: null }),
  showDead: true,
  pickedClosure: null,
  setShowDead: (on) => set({ showDead: on }),
  pickClosure: (state) => set({ pickedClosure: state, playing: false, stepping: false }),
}))
