/**
 * A step/frame player shared by the Convert and Test tabs: which step and
 * micro-step (frame) is shown, playback, single steps, speed and Instant
 * mode. Each tab makes its own store from {@link playerSlice}.
 */

import type { StoreApi, UseBoundStore } from 'zustand'

/** Time per step in Instant mode at 1× speed, in ms. */
export const INSTANT_STEP_MS = 700

/** The player's state and actions. */
export interface PlayerState {
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

  /** Loads a new plan and shows the first step (or, with `at: 'end'`, the last one), completed. */
  load: (counts: number[], at?: 'start' | 'end') => void
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
}

/** A zustand hook whose state includes the player. */
export type PlayerStore = UseBoundStore<StoreApi<PlayerState>>

const lastFrame = (counts: number[], step: number) => Math.max(0, (counts[step] ?? 1) - 1)

type Set<T> = (partial: Partial<T>) => void
type Get<T> = () => T

/**
 * The player part of a zustand store.
 *
 * @param set - The store's `set`.
 * @param get - The store's `get`.
 * @param onInteract - Extra state to reset whenever playback starts or a step is taken (e.g. a picked table row).
 * @returns The initial player state and its actions.
 * @throws Never throws.
 */
export function playerSlice<T extends PlayerState>(set: Set<T>, get: Get<T>, onInteract: Partial<T> = {}): PlayerState {
  const s = set as Set<PlayerState>
  return {
    counts: [],
    step: 0,
    frame: 0,
    playing: false,
    stepping: false,
    live: false,
    speed: 1,
    instant: false,

    load: (counts, at = 'start') => {
      const step = at === 'end' ? Math.max(0, counts.length - 1) : 0
      s({ counts, step, frame: lastFrame(counts, step), playing: false, stepping: false, live: false })
    },

    tick: () => {
      const { counts, step, frame, playing, instant } = get()
      if (!instant && frame < lastFrame(counts, step)) {
        s({ frame: frame + 1 })
        return
      }
      if (playing && step < counts.length - 1) {
        const next = step + 1
        s({ step: next, frame: instant ? lastFrame(counts, next) : 0, live: !instant })
        return
      }
      s({ playing: false, stepping: false })
    },

    play: () => {
      const { counts, step, frame, instant } = get()
      if (counts.length === 0) return
      const atEnd = step >= counts.length - 1 && frame >= lastFrame(counts, step)
      if (atEnd) set({ step: 0, frame: instant ? lastFrame(counts, 0) : 0, live: !instant, playing: true, stepping: false, ...onInteract })
      else set({ playing: true, stepping: false, ...onInteract })
    },
    pause: () => s({ playing: false, stepping: false }),
    togglePlay: () => (get().playing ? get().pause() : get().play()),

    stepForward: () => {
      const { counts, step, instant } = get()
      if (step >= counts.length - 1) {
        // Finish the last step instantly.
        s({ frame: lastFrame(counts, step), playing: false, stepping: false })
        return
      }
      const next = step + 1
      set({
        step: next,
        frame: instant ? lastFrame(counts, next) : 0,
        live: !instant,
        playing: false,
        stepping: !instant,
        ...onInteract,
      })
    },
    stepBack: () => get().jump(Math.max(0, get().step - 1)),
    skipBack: () => get().jump(0),
    skipForward: () => get().jump(Math.max(0, get().counts.length - 1)),
    jump: (step) => s({ step, frame: lastFrame(get().counts, step), playing: false, stepping: false, live: false }),

    setSpeed: (speed) => s({ speed }),
    setInstant: (on) => {
      const { counts, step } = get()
      s(on ? { instant: true, frame: lastFrame(counts, step), stepping: false, live: false } : { instant: false })
    },
  }
}

/**
 * How long the current frame stays on screen before the clock ticks.
 *
 * @param plan - Frames per step; each frame has a base duration `ms` at 1× speed.
 * @param s - Current player state.
 * @param fallbackMs - Duration used when the frame is missing.
 * @returns Delay in ms at the current speed.
 * @throws Never throws.
 */
export function frameDelay(plan: readonly (readonly { ms: number }[])[], s: Pick<PlayerState, 'step' | 'frame' | 'speed' | 'instant'>, fallbackMs = 480): number {
  const base = s.instant ? INSTANT_STEP_MS : (plan[s.step]?.[s.frame]?.ms ?? fallbackMs)
  return base / s.speed
}
