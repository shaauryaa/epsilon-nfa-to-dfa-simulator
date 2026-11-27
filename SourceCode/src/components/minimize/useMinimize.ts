import { useEffect, useMemo } from 'react'
import { canvasState, type MinCanvasState, type MinFrame, type MinStep } from '../../model/minimizeView'
import { frameDelay } from '../../store/player'
import { getMinimization, useMinimize, type Minimization } from '../../store/minimize'
import { useConversion, usePlayerKeys } from '../convert/useConversion'

/** The walkthrough for the converted DFA, or `null` while the machine has errors. */
export function useMinimization(): Minimization | null {
  const conversion = useConversion()
  return useMemo(() => (conversion ? getMinimization(conversion.result.dfa) : null), [conversion])
}

/** Everything the Minimize views need about the point the player is at. */
export interface MinimizeViewState {
  min: Minimization
  index: number
  step: MinStep
  frame: MinFrame
  canvas: MinCanvasState
  /** True when the current step animates from its first frame. */
  live: boolean
  atEnd: boolean
}

/** The player's current step and frame, with the canvas state; `null` while the machine has errors. */
export function useMinimizeView(): MinimizeViewState | null {
  const min = useMinimization()
  const stepIndex = useMinimize((s) => s.step)
  const frameIndex = useMinimize((s) => s.frame)
  const live = useMinimize((s) => s.live)
  return useMemo(() => {
    if (!min) return null
    const index = Math.min(stepIndex, min.view.steps.length - 1)
    const frames = min.plan[index]
    const frame = frames[Math.min(frameIndex, frames.length - 1)]
    return {
      min,
      index,
      step: min.view.steps[index],
      frame,
      canvas: canvasState(min.view, index, frame.phase),
      live: live && !min.view.large,
      atEnd: index === min.view.steps.length - 1,
    }
  }, [min, stepIndex, frameIndex, live])
}

let loaded: Minimization | null | undefined

/**
 * Drives the Minimize player while the tab is open: loads the frames when
 * the walkthrough changes, advances on a timer while playing, and handles
 * Space and ←/→.
 */
export function useMinimizeClock(): void {
  const min = useMinimization()
  const load = useMinimize((s) => s.load)
  const step = useMinimize((s) => s.step)
  const frame = useMinimize((s) => s.frame)
  const playing = useMinimize((s) => s.playing)
  const stepping = useMinimize((s) => s.stepping)
  const speed = useMinimize((s) => s.speed)
  const instant = useMinimize((s) => s.instant)

  useEffect(() => {
    if (min === loaded) return
    loaded = min
    load(min ? min.plan.map((f) => f.length) : [])
  }, [min, load])

  useEffect(() => {
    if (!min || !(playing || stepping)) return
    const id = window.setTimeout(() => useMinimize.getState().tick(), frameDelay(min.plan, { step, frame, speed, instant }))
    return () => window.clearTimeout(id)
  }, [min, playing, stepping, step, frame, speed, instant])

  useEffect(() => () => useMinimize.getState().pause(), [])
  usePlayerKeys(useMinimize)
}
