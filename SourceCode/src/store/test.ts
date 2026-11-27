/**
 * Test-mode state: the input string, its player, the batch textarea and
 * the last batch and equivalence runs.
 */

import { create } from 'zustand'
import type { ENFA, EquivalenceResult } from '../core'
import { playerSlice, type PlayerState } from './player'

/** Default and range of the equivalence check's length bound. */
export const EQUIV_LEN = { min: 1, max: 10, initial: 8 }

export interface TestState extends PlayerState {
  /** The single-string input; `null` until the tab first opens (it is then seeded from the preset). */
  input: string | null
  batchText: string
  /** The textarea text at the last Run, or `null` before the first run. */
  batchRun: string | null
  maxLen: number
  /** The last equivalence check and the machine it ran on. */
  equivalence: { nfa: ENFA; maxLen: number; result: EquivalenceResult } | null
  setInput: (input: string) => void
  setBatchText: (text: string) => void
  runBatch: () => void
  setMaxLen: (n: number) => void
  setEquivalence: (e: TestState['equivalence']) => void
}

export const useTest = create<TestState>((set, get) => ({
  ...playerSlice<TestState>(set, get),
  input: null,
  batchText: '',
  batchRun: null,
  maxLen: EQUIV_LEN.initial,
  equivalence: null,
  setInput: (input) => set({ input }),
  setBatchText: (batchText) => set({ batchText }),
  runBatch: () => set({ batchRun: get().batchText }),
  setMaxLen: (maxLen) => set({ maxLen: Math.min(EQUIV_LEN.max, Math.max(EQUIV_LEN.min, Math.round(maxLen))) }),
  setEquivalence: (equivalence) => set({ equivalence }),
}))
