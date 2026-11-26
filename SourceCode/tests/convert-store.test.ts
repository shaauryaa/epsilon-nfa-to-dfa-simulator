import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subsetConstruction } from '../src/core'
import { getPreset } from '../src/presets'
import { frameDelay, getConversion, INSTANT_STEP_MS, useConvert } from '../src/store/convert'

const nfa = getPreset('thompson-abb')!.nfa
const subset = subsetConstruction(nfa)
const conv = getConversion(nfa, subset, true)!
const counts = conv.plan.map((f) => f.length)
const s = () => useConvert.getState()

describe('Convert player', () => {
  beforeEach(() => {
    useConvert.setState({ instant: false, speed: 1 })
    s().load(counts)
  })

  it('loads at the first step, completed and paused', () => {
    expect(s().step).toBe(0)
    expect(s().frame).toBe(counts[0] - 1)
    expect(s().playing).toBe(false)
  })

  it('step forward animates the next step from its first frame, then stops at its end', () => {
    s().stepForward()
    expect(s()).toMatchObject({ step: 1, frame: 0, stepping: true, live: true, playing: false })
    for (let i = 0; i < counts[1] + 2; i++) s().tick()
    expect(s()).toMatchObject({ step: 1, frame: counts[1] - 1, stepping: false })
  })

  it('stepping while a step animates finishes it and moves on', () => {
    s().stepForward()
    s().tick()
    s().stepForward()
    expect(s()).toMatchObject({ step: 2, frame: 0 })
  })

  it('play runs through every step and stops at the end', () => {
    s().play()
    for (let i = 0; i < 500 && s().playing; i++) s().tick()
    expect(s().playing).toBe(false)
    expect(s().step).toBe(counts.length - 1)
  })

  it('play at the end restarts from the beginning', () => {
    s().skipForward()
    s().play()
    expect(s()).toMatchObject({ step: 0, frame: 0, playing: true })
  })

  it('step back, skip back and jumps show completed steps without animating', () => {
    s().jump(5)
    expect(s()).toMatchObject({ step: 5, frame: counts[5] - 1, live: false })
    s().stepBack()
    expect(s().step).toBe(4)
    s().skipBack()
    expect(s().step).toBe(0)
  })

  it('Instant mode skips the micro-steps', () => {
    s().setInstant(true)
    s().stepForward()
    expect(s()).toMatchObject({ step: 1, frame: counts[1] - 1, stepping: false })
    expect(frameDelay(conv.plan, { step: 1, frame: 0, speed: 2, instant: true })).toBe(INSTANT_STEP_MS / 2)
  })

  it('speed scales the frame delay', () => {
    const at1 = frameDelay(conv.plan, { step: 1, frame: 0, speed: 1, instant: false })
    expect(frameDelay(conv.plan, { step: 1, frame: 0, speed: 2, instant: false })).toBe(at1 / 2)
  })

  it('picking a closure row pauses playback', () => {
    s().play()
    s().pickClosure('3')
    expect(s()).toMatchObject({ playing: false, pickedClosure: '3' })
  })
})

describe('getConversion', () => {
  it('reuses the derived result with the dead state and caches per machine', () => {
    expect(getConversion(nfa, subset, true)!.result).toBe(subset)
    expect(getConversion(nfa, subset, true)).toBe(getConversion(nfa, subset, true))
    expect(getConversion(nfa, null, true)).toBeNull()
  })

  it('re-runs without the dead state when it is hidden', () => {
    const p = getPreset('dead-state')!.nfa
    const withDead = subsetConstruction(p)
    const without = getConversion(p, withDead, false)!.result
    expect(without.dfa.deadState).toBeNull()
    expect(without.dfa.states.length).toBe(withDead.dfa.states.length - 1)
  })
})

describe('toasts', () => {
  it('shows at most one toast: a new one replaces the current one', async () => {
    vi.stubGlobal('window', globalThis)
    const { useToasts, toast } = await import('../src/store/toasts')
    toast({ message: 'first', tone: 'info' })
    toast({ message: 'second', tone: 'info' })
    toast({ message: 'third', tone: 'success' })
    expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['third'])
    vi.unstubAllGlobals()
  })
})
