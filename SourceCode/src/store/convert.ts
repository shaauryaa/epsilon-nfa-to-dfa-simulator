/**
 * Convert-mode state: which subset-construction step and micro-step (frame)
 * is shown, playback, speed, the Instant and dead-state toggles, and the
 * ε-closure row picked in the closure table.
 */

import { create } from 'zustand'
import { subsetConstruction, type ENFA, type SubsetResult } from '../core'
import { FRAME_MS, planAll, type Frame } from '../model/convertPlan'
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

/** Time per step in Instant mode at 1× speed, in ms. */
export const INSTANT_STEP_MS = 700

export interface ConvertState {
  /** Frames per step of the loaded plan. */
  counts: number[]
  step: number
  frame: number
  playing: boolean
  /** True while a single step plays after Step forward. */
  stepping: boolean
  /** True when the current step is being animated from its first frame (not reached by a jump). */
  live: boolean
  speed: number
  instant: boolean
  showDead: boolean
  pickedClosure: string | null

  /** Loads a new plan and shows the first step, completed. */
  load: (counts: number[]) => void
  /** Advances one frame (or one step in Instant mode). Called by the clock. */
  tick: () => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  stepForward: () => void
  stepBack: () => void
  skipBack: () => void
  skipForward: () => void
  /** Shows a step, completed, without animation. */
  jump: (step: number) => void
  setSpeed: (speed: number) => void
  setInstant: (on: boolean) => void
  setShowDead: (on: boolean) => void
  pickClosure: (state: string | null) => void
}

const lastFrame = (counts: number[], step: number) => Math.max(0, (counts[step] ?? 1) - 1)

export const useConvert = create<ConvertState>((set, get) => ({
  counts: [],
  step: 0,
  frame: 0,
  playing: false,
  stepping: false,
  live: false,
  speed: 1,
  instant: false,
  showDead: true,
  pickedClosure: null,

  load: (counts) => set({ counts, step: 0, frame: lastFrame(counts, 0), playing: false, stepping: false, live: false }),

  tick: () => {
    const { counts, step, frame, playing, instant } = get()
    if (!instant && frame < lastFrame(counts, step)) {
      set({ frame: frame + 1 })
      return
    }
    if (playing && step < counts.length - 1) {
      const next = step + 1
      set({ step: next, frame: instant ? lastFrame(counts, next) : 0, live: !instant })
      return
    }
    set({ playing: false, stepping: false })
  },

  play: () => {
    const { counts, step, frame, instant } = get()
    if (counts.length === 0) return
    const atEnd = step >= counts.length - 1 && frame >= lastFrame(counts, step)
    if (atEnd) set({ step: 0, frame: instant ? lastFrame(counts, 0) : 0, live: !instant, playing: true, stepping: false, pickedClosure: null })
    else set({ playing: true, stepping: false, pickedClosure: null })
  },
  pause: () => set({ playing: false, stepping: false }),
  togglePlay: () => (get().playing ? get().pause() : get().play()),

  stepForward: () => {
    const { counts, step, instant } = get()
    if (step >= counts.length - 1) {
      // Finish the last step instantly.
      set({ frame: lastFrame(counts, step), playing: false, stepping: false })
      return
    }
    const next = step + 1
    set({
      step: next,
      frame: instant ? lastFrame(counts, next) : 0,
      live: !instant,
      playing: false,
      stepping: !instant,
      pickedClosure: null,
    })
  },
  stepBack: () => get().jump(Math.max(0, get().step - 1)),
  skipBack: () => get().jump(0),
  skipForward: () => get().jump(Math.max(0, get().counts.length - 1)),
  jump: (step) => set({ step, frame: lastFrame(get().counts, step), playing: false, stepping: false, live: false }),

  setSpeed: (speed) => set({ speed }),
  setInstant: (on) => {
    const { counts, step } = get()
    set(on ? { instant: true, frame: lastFrame(counts, step), stepping: false, live: false } : { instant: false })
  },
  setShowDead: (on) => set({ showDead: on }),
  pickClosure: (state) => set({ pickedClosure: state, playing: false, stepping: false }),
}))

/**
 * How long the current frame stays on screen before the clock ticks.
 *
 * @param plan - The animation plan.
 * @param s - Current player state.
 * @returns Delay in ms at the current speed.
 */
export function frameDelay(plan: Frame[][], s: Pick<ConvertState, 'step' | 'frame' | 'speed' | 'instant'>): number {
  const base = s.instant ? INSTANT_STEP_MS : (plan[s.step]?.[s.frame]?.ms ?? FRAME_MS.cell)
  return base / s.speed
}
