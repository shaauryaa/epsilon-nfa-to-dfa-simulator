/**
 * Minimize-mode state: the refinement walkthrough's player (step, frame,
 * playback, speed, Instant). The walkthrough itself is derived from the
 * converted DFA and cached here.
 */

import { create } from 'zustand'
import type { DFA } from '../core'
import { buildMinimizeView, planMinimize, type MinFrame, type MinimizeView } from '../model/minimizeView'
import { playerSlice, type PlayerState } from './player'

/** A walkthrough ready to play. */
export interface Minimization {
  view: MinimizeView
  /** Frames per step. */
  plan: MinFrame[][]
}

let cache: { dfa: DFA; value: Minimization } | null = null

/**
 * The walkthrough for a DFA, cached for the last DFA object.
 *
 * @param dfa - The DFA to minimise (the converted DFA as shown in Convert).
 * @returns The walkthrough and its frames.
 */
export function getMinimization(dfa: DFA): Minimization {
  if (cache && cache.dfa === dfa) return cache.value
  const view = buildMinimizeView(dfa)
  const value = { view, plan: planMinimize(view) }
  cache = { dfa, value }
  return value
}

export type MinimizeState = PlayerState

export const useMinimize = create<MinimizeState>((set, get) => ({
  ...playerSlice<MinimizeState>(set, get),
}))
