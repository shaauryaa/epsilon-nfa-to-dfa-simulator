import { useEffect, useMemo } from 'react'
import type { DFA, ENFA } from '../../core'
import { MAX_ANIMATED_SYMBOLS, buildTrace, checkInput, expectedIndex, parseBatch, runBatch, type BatchRow, type InputCheck, type Machines, type RunTrace } from '../../model/testRun'
import { planRun, type RunFrame } from '../../model/testPlan'
import { getPreset } from '../../presets'
import { useApp } from '../../store/automaton'
import { getConversion, useConvert, type Conversion } from '../../store/convert'
import { frameDelay } from '../../store/player'
import { useTest } from '../../store/test'
import { useConversion, usePlayerKeys } from '../convert/useConversion'

/** Everything the Test views need about the current input. */
export interface TestRun {
  input: string
  check: InputCheck
  /** `null` when the input is not over Σ. */
  trace: RunTrace | null
  /** Frames per step; empty when the run is not animated. */
  plan: RunFrame[][]
  /** Why the run is shown as text only: the DFA is too large to draw, or the input is very long. */
  still: 'large' | 'long' | null
}

let runCache: { nfa: ENFA; dfa: DFA; input: string; large: boolean; value: TestRun } | null = null

/**
 * Checks, runs and plans one input. Cached for the last machine and input.
 *
 * @param nfa - The ε-NFA.
 * @param conversion - The current conversion (its DFA is the one shown).
 * @param input - The raw input.
 * @returns The run.
 */
export function computeRun(nfa: ENFA, conversion: Conversion, input: string): TestRun {
  const dfa = conversion.result.dfa
  if (runCache && runCache.nfa === nfa && runCache.dfa === dfa && runCache.input === input && runCache.large === conversion.large) return runCache.value
  const check = checkInput(input, nfa.alphabet)
  const trace = check.ok ? buildTrace(nfa, dfa, check.tokens) : null
  const still = conversion.large ? 'large' : trace && trace.tokens.length > MAX_ANIMATED_SYMBOLS ? 'long' : null
  const plan = trace && !still ? planRun(nfa, trace) : []
  const value: TestRun = { input, check, trace, plan, still }
  runCache = { nfa, dfa, input, large: conversion.large, value }
  return value
}

/** The ε-NFA, the shown DFA and the minimal DFA, or `null` while the machine has errors. */
export function currentMachines(): (Machines & { conversion: Conversion }) | null {
  const { nfa, subset, minimized } = useApp.getState()
  const conversion = getConversion(nfa, subset, useConvert.getState().showDead)
  if (!conversion || !minimized) return null
  return { nfa, dfa: conversion.result.dfa, min: minimized.dfa, conversion }
}

/** The current preset's expected strings, when the machine is an unedited preset that has them. */
export function presetExpected(): { accepts: string[]; rejects: string[] } | null {
  const id = useApp.getState().presetId
  const p = id ? getPreset(id) : undefined
  return p && p.expected.accepts.length + p.expected.rejects.length > 0 ? p.expected : null
}

/**
 * Runs a batch text on the current machines.
 *
 * @param m - The machines.
 * @param text - The textarea text.
 * @param expected - The preset's expected strings, if any.
 * @returns The table rows.
 */
export function computeBatch(m: Machines, text: string, expected: { accepts: string[]; rejects: string[] } | null): BatchRow[] {
  return runBatch(parseBatch(text), m, expected ? expectedIndex(expected, m.nfa.alphabet) : undefined)
}

/** The single-string run for the current input, or `null` while the machine has errors. */
export function currentRun(): TestRun | null {
  const m = currentMachines()
  if (!m) return null
  return computeRun(m.nfa, m.conversion, useTest.getState().input ?? '')
}

/** The rows of the last batch run, or `null` before the first run or while the machine has errors. */
export function currentBatch(): BatchRow[] | null {
  const m = currentMachines()
  const text = useTest.getState().batchRun
  if (!m || text === null) return null
  return computeBatch(m, text, presetExpected())
}

/** Hook: the current run, recomputed when the machine, the dead-state switch or the input changes. */
export function useTestRun(): TestRun | null {
  const nfa = useApp((s) => s.nfa)
  const conversion = useConversion()
  const input = useTest((s) => s.input) ?? ''
  return useMemo(() => (conversion ? computeRun(nfa, conversion, input) : null), [nfa, conversion, input])
}

/** Hook: the current preset's expected strings (see {@link presetExpected}). */
export function usePresetExpected() {
  const id = useApp((s) => s.presetId)
  return useMemo(() => {
    const p = id ? getPreset(id) : undefined
    return p && p.expected.accepts.length + p.expected.rejects.length > 0 ? p.expected : null
  }, [id])
}

/** Hook: rows of the last batch run on the current machines (re-run automatically when the machine changes). */
export function useBatchRows(): BatchRow[] | null {
  const nfa = useApp((s) => s.nfa)
  const minimized = useApp((s) => s.minimized)
  const conversion = useConversion()
  const text = useTest((s) => s.batchRun)
  const expected = usePresetExpected()
  return useMemo(() => {
    if (!conversion || !minimized || text === null) return null
    return computeBatch({ nfa, dfa: conversion.result.dfa, min: minimized.dfa }, text, expected)
  }, [nfa, conversion, minimized, text, expected])
}

/** The run's player position, clamped to the plan. */
export interface TestView {
  run: TestRun & { trace: RunTrace }
  /** 0 = start, i = after symbol i. */
  step: number
  frame: RunFrame | null
  live: boolean
  /** True when the last step is shown. */
  atEnd: boolean
}

/** Hook: where the player is in the current run; `null` when there is no valid run. */
export function useTestView(): TestView | null {
  const run = useTestRun()
  const stepIndex = useTest((s) => s.step)
  const frameIndex = useTest((s) => s.frame)
  const live = useTest((s) => s.live)
  return useMemo(() => {
    if (!run || !run.trace) return null
    const total = run.trace.steps.length + 1
    if (run.plan.length === 0) return { run: run as TestView['run'], step: total - 1, frame: null, live: false, atEnd: true }
    const step = Math.min(stepIndex, run.plan.length - 1)
    const frames = run.plan[step]
    const frame = frames[Math.min(frameIndex, frames.length - 1)]
    return { run: run as TestView['run'], step, frame, live, atEnd: step === run.plan.length - 1 }
  }, [run, stepIndex, frameIndex, live])
}

let loadedPlan: RunFrame[][] | undefined

/**
 * Drives the Test player while the tab is open: loads the plan when the
 * run changes (showing the finished run, so the verdict is visible at
 * once) and advances frames on a timer while playing or stepping.
 */
export function useTestClock(): void {
  const run = useTestRun()
  const load = useTest((s) => s.load)
  const step = useTest((s) => s.step)
  const frame = useTest((s) => s.frame)
  const playing = useTest((s) => s.playing)
  const stepping = useTest((s) => s.stepping)
  const speed = useTest((s) => s.speed)
  const instant = useTest((s) => s.instant)
  const plan = run?.plan
  usePlayerKeys(useTest)

  useEffect(() => {
    if (plan === loadedPlan) return
    loadedPlan = plan
    load(plan ? plan.map((f) => f.length) : [], 'end')
  }, [plan, load])

  useEffect(() => {
    if (!plan || plan.length === 0 || !(playing || stepping)) return
    const id = window.setTimeout(() => useTest.getState().tick(), frameDelay(plan, { step, frame, speed, instant }))
    return () => window.clearTimeout(id)
  }, [plan, playing, stepping, step, frame, speed, instant])
}
