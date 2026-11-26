/**
 * Plans the step-by-step subset construction animation: each recorded step
 * becomes a short list of frames (micro-steps), and each frame is a full
 * snapshot of what the ε-NFA graph, the DFA graph and the DFA table show.
 * Snapshots make step back and jumping trivial: render any frame directly.
 */

import { EPSILON, epsilonClosureTrace, formatSet, type DFA, type ENFA, type SubsetResult, type SubsetStep } from '../core'

/** What a frame does, for styling and timing. */
export type FramePhase = 'pulse' | 'move' | 'closure' | 'dfa' | 'cell' | 'done'

/** An NFA edge `[from, to]`. */
export type EdgePair = [string, string]

/** One micro-step of the animation. */
export interface Frame {
  phase: FramePhase
  /** Sentence shown in the explanation bar while this frame plays. */
  text: string
  /** The set S being expanded, drawn filled on the ε-NFA. */
  current: string[]
  /** move(S, a), drawn outlined. */
  moved: string[]
  /** ε-closure states reached so far, drawn in the second colour. */
  closure: string[]
  /** Symbol edges taken in this step (symbol = the step's symbol). */
  symbolEdges: EdgePair[]
  /** ε-edges followed so far. */
  epsilonEdges: EdgePair[]
  /** True on the frame where tokens travel along `symbolEdges`. */
  tokens: boolean
  /** True on the frame where S pulses. */
  pulse: boolean
  /** True once the target DFA state and its new edge are shown. */
  revealed: boolean
  /** True once the DFA table cell is filled. */
  filled: boolean
  /** Base duration in ms at 1× speed. */
  ms: number
}

/** Base durations at 1× speed, in ms. */
export const FRAME_MS: Record<FramePhase, number> = { pulse: 520, move: 820, closure: 340, dfa: 620, cell: 480, done: 600 }
/** At most this many closure frames per step; larger closures light several states per frame. */
const MAX_CLOSURE_FRAMES = 10

const empty = (): Omit<Frame, 'phase' | 'text' | 'ms'> => ({
  current: [],
  moved: [],
  closure: [],
  symbolEdges: [],
  epsilonEdges: [],
  tokens: false,
  pulse: false,
  revealed: false,
  filled: false,
})

/**
 * Builds the closure frames: the closure spreads from `seeds` along ε-edges
 * in search order, lighting each newly reached state in turn.
 */
function closureFrames(nfa: ENFA, seeds: string[], base: Omit<Frame, 'phase' | 'text' | 'ms'>, target: string[]): Frame[] {
  const { edges } = epsilonClosureTrace(nfa, seeds)
  if (edges.length === 0) {
    return [
      {
        ...base,
        phase: 'closure',
        closure: [...seeds],
        text:
          seeds.length === 0
            ? 'The ε-closure of ∅ is ∅.'
            : `No ε-edges leave ${formatSet(seeds)}, so its ε-closure is ${formatSet(target)}.`,
        ms: FRAME_MS.closure,
      },
    ]
  }
  // Group the edges into reveal batches: each batch ends at an edge that reaches a new state.
  const seen = new Set(seeds)
  const batches: { edges: EdgePair[]; reached: string[] }[] = []
  let cur: { edges: EdgePair[]; reached: string[] } = { edges: [], reached: [] }
  for (const [from, to] of edges) {
    cur.edges.push([from, to])
    if (!seen.has(to)) {
      seen.add(to)
      cur.reached.push(to)
      batches.push(cur)
      cur = { edges: [], reached: [] }
    }
  }
  if (cur.edges.length > 0) {
    if (batches.length > 0) batches[batches.length - 1].edges.push(...cur.edges)
    else batches.push(cur)
  }
  // Merge batches so long closures stay within MAX_CLOSURE_FRAMES frames.
  const per = Math.ceil(batches.length / MAX_CLOSURE_FRAMES)
  const merged: { edges: EdgePair[]; reached: string[] }[] = []
  for (let i = 0; i < batches.length; i += per) {
    const group = batches.slice(i, i + per)
    merged.push({ edges: group.flatMap((b) => b.edges), reached: group.flatMap((b) => b.reached) })
  }

  const order = new Map(nfa.states.map((s, i) => [s, i]))
  const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  const lit = new Set(seeds)
  const used: EdgePair[] = []
  return merged.map((b, i) => {
    b.reached.forEach((s) => lit.add(s))
    used.push(...b.edges)
    const last = i === merged.length - 1
    const via = b.edges.filter(([, to]) => b.reached.includes(to)).map(([f, t]) => `${f} → ${t}`)
    let text: string
    if (b.reached.length === 0) text = `The remaining ε-edges lead back into the closure.`
    else if (via.length === 1) text = `Follow ε-edge ${via[0]}: reach ${b.reached[0]}.`
    else text = `Follow ε-edges ${via.join(', ')}: reach ${b.reached.join(', ')}.`
    if (last) text += ` ε-closure = ${formatSet(target)}.`
    return { ...base, phase: 'closure', closure: sorted(lit), epsilonEdges: [...used], text, ms: FRAME_MS.closure }
  })
}

/**
 * Lists the symbol edges taken by move(S, a): every `s --a--> t` with s in S.
 *
 * @param nfa - The ε-NFA.
 * @param from - The set S.
 * @param symbol - The symbol a.
 * @returns The edges, in source then target order.
 * @throws Never throws.
 */
export function moveEdges(nfa: ENFA, from: readonly string[], symbol: string): EdgePair[] {
  const out: EdgePair[] = []
  for (const s of from) for (const t of nfa.transitions[s]?.[symbol] ?? []) out.push([s, t])
  return out
}

/**
 * Plans the frames for one subset-construction step.
 *
 * - `start`: the start state pulses, the closure spreads, DFA state A appears.
 * - `transition`: S pulses; tokens carry the symbol along each symbol edge
 *   and the targets light up as move(S, a); the ε-closure spreads edge by
 *   edge; the target DFA state grows in (or flashes if it already exists)
 *   and its edge draws; the table cell fills.
 * - `done`: a single summary frame.
 *
 * @param nfa - The ε-NFA that was converted.
 * @param step - One step from `subsetConstruction`.
 * @returns At least one frame; the last frame is the completed step.
 * @throws Never throws.
 */
export function planStep(nfa: ENFA, step: SubsetStep): Frame[] {
  if (step.kind === 'done') {
    return [{ ...empty(), phase: 'done', text: step.explanation, revealed: true, filled: true, ms: FRAME_MS.done }]
  }

  if (step.kind === 'start') {
    const seeds = [nfa.start]
    const pulse: Frame = {
      ...empty(),
      phase: 'pulse',
      current: seeds,
      closure: seeds,
      pulse: true,
      text: `Begin at the ε-NFA's start state ${nfa.start}.`,
      ms: FRAME_MS.pulse,
    }
    const spread = closureFrames(nfa, seeds, { ...empty(), current: seeds }, step.closureSet)
    const last = spread[spread.length - 1]
    const reveal: Frame = { ...last, phase: 'dfa', revealed: true, filled: true, text: step.explanation, ms: FRAME_MS.dfa }
    return [pulse, ...spread, reveal]
  }

  const from = step.fromSet ?? []
  const symbol = step.symbol ?? ''
  const moved = step.moveSet ?? []
  const edges = moveEdges(nfa, from, symbol)
  const pulse: Frame = {
    ...empty(),
    phase: 'pulse',
    current: from,
    pulse: true,
    text: `Expand ${step.from} = ${formatSet(from)} on symbol ${symbol}.`,
    ms: FRAME_MS.pulse,
  }
  const move: Frame = {
    ...pulse,
    phase: 'move',
    pulse: false,
    tokens: edges.length > 0,
    symbolEdges: edges,
    moved,
    text:
      edges.length === 0
        ? `No ${symbol}-edges leave ${formatSet(from)}, so move(${step.from}, ${symbol}) = ∅.`
        : `Follow every ${symbol}-edge out of ${step.from}: move(${step.from}, ${symbol}) = ${formatSet(moved)}.`,
    ms: edges.length === 0 ? FRAME_MS.pulse : FRAME_MS.move,
  }
  const spread = closureFrames(nfa, moved, { ...move, tokens: false }, step.closureSet)
  const last = spread[spread.length - 1]
  const frames: Frame[] = [pulse, move, ...spread]
  if (step.to !== null) {
    let text: string
    if (!step.isNew) text = `${formatSet(step.closureSet)} is already state ${step.to}; add the edge ${step.from} --${symbol}--> ${step.to}.`
    else if (step.closureSet.length === 0) text = `The empty set becomes the dead state ∅; add ${step.from} --${symbol}--> ∅.`
    else text = `${formatSet(step.closureSet)} is new: it becomes state ${step.to}.`
    frames.push({ ...last, phase: 'dfa', revealed: true, text, ms: FRAME_MS.dfa })
  }
  frames.push({ ...last, phase: 'cell', revealed: true, filled: true, text: step.explanation, ms: FRAME_MS.cell })
  return frames
}

/**
 * Plans every step of a conversion.
 *
 * @param nfa - The ε-NFA that was converted.
 * @param result - The output of `subsetConstruction`.
 * @returns One frame list per step, in step order.
 * @throws Never throws.
 */
export function planAll(nfa: ENFA, result: SubsetResult): Frame[][] {
  return result.steps.map((s) => planStep(nfa, s))
}

/** What the DFA side shows at some point of the animation. */
export interface DfaProgress {
  /** DFA states discovered so far, in discovery order. */
  states: string[]
  /** Transitions added so far. */
  transitions: Record<string, Record<string, string>>
  /** The state created by the current frame, if any (it animates in). */
  entering: string | null
  /** An existing state the current frame points at (it flashes). */
  flashing: string | null
  /** The edge drawn by the current frame. */
  drawing: { from: string; symbol: string; to: string } | null
  /** The table cell the current step fills. */
  cell: { state: string; symbol: string } | null
  /** True when the current frame has filled `cell`. */
  cellFilled: boolean
}

/**
 * Works out which DFA states, edges and table cells are visible at a frame.
 * Steps before `stepIndex` are complete; the current step contributes its
 * state and edge once `frame.revealed`, and its cell once `frame.filled`.
 *
 * @param dfa - The finished DFA (names and subsets).
 * @param steps - The step list.
 * @param stepIndex - Current step (0-based).
 * @param frame - The current frame of that step.
 * @returns The visible part of the DFA.
 * @throws Never throws.
 */
export function dfaProgress(dfa: DFA, steps: readonly SubsetStep[], stepIndex: number, frame: Pick<Frame, 'revealed' | 'filled'>): DfaProgress {
  const states: string[] = []
  const transitions: Record<string, Record<string, string>> = {}
  const add = (s: SubsetStep, withEdge: boolean) => {
    if (s.to !== null && s.isNew && !states.includes(s.to)) states.push(s.to)
    if (withEdge && s.kind === 'transition' && s.from && s.symbol !== undefined && s.to !== null) {
      ;(transitions[s.from] ??= {})[s.symbol] = s.to
    }
  }
  for (let i = 0; i < stepIndex && i < steps.length; i++) add(steps[i], true)
  const step = steps[stepIndex]
  let entering: string | null = null
  let flashing: string | null = null
  let drawing: DfaProgress['drawing'] = null
  let cell: DfaProgress['cell'] = null
  if (step) {
    if (frame.revealed) add(step, true)
    if (step.kind !== 'done' && frame.revealed && step.to !== null) {
      if (step.isNew) entering = step.to
      else flashing = step.to
      if (step.kind === 'transition') drawing = { from: step.from!, symbol: step.symbol!, to: step.to }
    }
    if (step.kind === 'transition') cell = { state: step.from!, symbol: step.symbol! }
  }
  // Keep discovery order identical to the DFA's own state order.
  const order = new Map(dfa.states.map((s, i) => [s, i]))
  states.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
  return { states, transitions, entering, flashing, drawing, cell, cellFilled: !!cell && frame.filled }
}

/** Short label for a step's timeline pill and its sub-label. */
export function stepPill(step: SubsetStep): { label: string; sublabel: string } {
  if (step.kind === 'start') return { label: 'START', sublabel: `→ ${step.to}` }
  if (step.kind === 'done') return { label: 'DONE', sublabel: '' }
  return { label: `${step.from}·${step.symbol === EPSILON ? 'ε' : step.symbol}`, sublabel: `→ ${step.to ?? '—'}` }
}
