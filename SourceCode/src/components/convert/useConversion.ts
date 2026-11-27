import { useEffect, useMemo } from 'react'
import type { SubsetStep } from '../../core'
import { dfaProgress, stepPill, type DfaProgress, type Frame } from '../../model/convertPlan'
import { useApp } from '../../store/automaton'
import { frameDelay, getConversion, useConvert, type Conversion } from '../../store/convert'
import type { PlayerStore } from '../../store/player'

/** The conversion for the current machine and dead-state setting, or `null` while the machine has errors. */
export function useConversion(): Conversion | null {
  const nfa = useApp((s) => s.nfa)
  const subset = useApp((s) => s.subset)
  const showDead = useConvert((s) => s.showDead)
  return useMemo(() => getConversion(nfa, subset, showDead), [nfa, subset, showDead])
}

/** Everything the Convert views need about the point the player is at. */
export interface ConvertView {
  conversion: Conversion
  step: SubsetStep
  frame: Frame
  progress: DfaProgress
  /** True when the current step is animating from its start (not reached by a jump). */
  live: boolean
}

/** The player's current step, frame and DFA progress; `null` while there is nothing to animate (errors, or a large DFA). */
export function useConvertView(): ConvertView | null {
  const conversion = useConversion()
  const stepIndex = useConvert((s) => s.step)
  const frameIndex = useConvert((s) => s.frame)
  const live = useConvert((s) => s.live)
  return useMemo(() => {
    if (!conversion || conversion.large) return null
    const { result, plan } = conversion
    const step = result.steps[Math.min(stepIndex, result.steps.length - 1)]
    const frames = plan[step.index]
    const frame = frames[Math.min(frameIndex, frames.length - 1)]
    return { conversion, step, frame, progress: dfaProgress(result.dfa, result.steps, step.index, frame), live }
  }, [conversion, stepIndex, frameIndex, live])
}

/** The conversion the player was last loaded with, so revisiting the tab keeps its place. */
let loaded: Conversion | null | undefined

function typingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t?.closest?.('input, textarea, select, [contenteditable="true"]')
}

/**
 * Drives the Convert player while the tab is open: loads the plan whenever
 * the conversion changes, advances frames on a timer while playing or
 * stepping, and handles the keyboard (Space plays or pauses, ←/→ step).
 */
export function useConvertClock(): void {
  const conversion = useConversion()
  const load = useConvert((s) => s.load)
  const step = useConvert((s) => s.step)
  const frame = useConvert((s) => s.frame)
  const playing = useConvert((s) => s.playing)
  const stepping = useConvert((s) => s.stepping)
  const speed = useConvert((s) => s.speed)
  const instant = useConvert((s) => s.instant)

  useEffect(() => {
    if (conversion === loaded) return
    loaded = conversion
    load(conversion && !conversion.large ? conversion.plan.map((f) => f.length) : [])
  }, [conversion, load])

  useEffect(() => {
    if (!conversion || !(playing || stepping)) return
    const id = window.setTimeout(() => useConvert.getState().tick(), frameDelay(conversion.plan, { step, frame, speed, instant }))
    return () => window.clearTimeout(id)
  }, [conversion, playing, stepping, step, frame, speed, instant])

  usePlayerKeys(useConvert)
}

/**
 * Player keyboard shortcuts while a tab is open: Space plays or pauses,
 * ←/→ step. Ignored while typing, and Space is left to focused buttons.
 *
 * @param store - The player store to drive.
 */
export function usePlayerKeys(store: PlayerStore): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return
      const s = store.getState()
      if (e.key === ' ' || e.code === 'Space') {
        // A focused button would also click on Space; let it, unless it is not a player control.
        const el = e.target as HTMLElement
        if (el.closest('button, [role="button"], a, summary')) return
        e.preventDefault()
        s.togglePlay()
      } else if (e.key === 'ArrowRight') {
        if ((e.target as HTMLElement).closest('[role="tablist"], [role="slider"]')) return
        e.preventDefault()
        s.stepForward()
      } else if (e.key === 'ArrowLeft') {
        if ((e.target as HTMLElement).closest('[role="tablist"], [role="slider"]')) return
        e.preventDefault()
        s.stepBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])
}

/** Timeline pills for the bottom panel: one per subset step. */
export function useConvertTimeline() {
  const view = useConvertView()
  if (!view) return null
  const steps = view.conversion.result.steps.map((s) => {
    const p = stepPill(s)
    return { kind: s.kind === 'start' ? ('start' as const) : s.kind === 'done' ? ('accept' as const) : ('step' as const), ...p }
  })
  return { steps, current: view.step.index }
}
