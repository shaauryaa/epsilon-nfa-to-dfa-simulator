/**
 * The Minimize tab's view model: the steps of DFA minimisation in the order
 * they are shown (round −1 unreachable states, completion, refinement
 * rounds, the stable round, the result), each with its explanation, its
 * blocks and a stable colour per block, plus the animation frames.
 *
 * Built only from the core `minimizeDFA` result, so it is plain data and
 * unit tested without a browser.
 */

import { checkEquivalence, formatSet, minimizeDFA, type DFA, type EquivalenceResult, type MinimizeResult, type PartitionSplit } from '../core'
import { isTooLargeToDraw } from './largeDfa'

/** Number of block colours before they repeat. */
export const BLOCK_COLOR_COUNT = 8

/** A block's colours on the canvas and in the block list (hex, light mode). */
export interface BlockColor {
  border: string
  fill: string
  text: string
}

/** Block colours: soft fills with a darker border of the same hue. */
export const BLOCK_COLORS: readonly BlockColor[] = [
  { border: '#2563eb', fill: '#dbeafe', text: '#1e3a8a' },
  { border: '#059669', fill: '#d1fae5', text: '#064e3b' },
  { border: '#d97706', fill: '#fef3c7', text: '#78350f' },
  { border: '#db2777', fill: '#fce7f3', text: '#831843' },
  { border: '#7c3aed', fill: '#ede9fe', text: '#4c1d95' },
  { border: '#0891b2', fill: '#cffafe', text: '#164e63' },
  { border: '#65a30d', fill: '#ecfccb', text: '#365314' },
  { border: '#dc2626', fill: '#fee2e2', text: '#7f1d1d' },
]

/**
 * The colour of a block colour index (indices wrap around the palette).
 *
 * @param index - A colour index from {@link MinStep}.colors.
 * @returns The colours.
 * @throws Never throws.
 */
export function blockColor(index: number): BlockColor {
  return BLOCK_COLORS[((index % BLOCK_COLOR_COUNT) + BLOCK_COLOR_COUNT) % BLOCK_COLOR_COUNT]
}

/** One edge used to explain a split. */
export interface WitnessEdge {
  from: string
  symbol: string
  to: string
}

/** One split of a block, explained. */
export interface SplitView {
  /** The block before the split. */
  group: string[]
  /** The symbols needed to tell the parts apart (usually one). */
  symbols: string[]
  /** The resulting blocks. */
  into: string[][]
  /** E.g. "{A,B,C,D} splits on b: D → E (final block), A, B, C stay in the non-final block." */
  text: string
  /** The edges that show the split: every member's move on each of `symbols`. */
  edges: WitnessEdge[]
  /** Members that leave for a new block (they get a new colour). */
  moved: string[]
  /**
   * A shortest string that tells two members apart: from `accepting` it ends
   * in a final state, from `rejecting` it does not. `null` for DFAs too
   * large to search.
   */
  witness: { word: string[]; accepting: string; rejecting: string } | null
}

/** Kinds of step, in the order they appear. */
export type MinStepKind = 'unreachable' | 'complete' | 'round' | 'stable' | 'done'

/** One step of the minimisation walkthrough. */
export interface MinStep {
  kind: MinStepKind
  /** Refinement round number; −1 for unreachable states, `null` for completion and the result. */
  round: number | null
  /** Timeline pill text, e.g. `−1`, `∅`, `R2`, `Done`. */
  pill: string
  /** Small text under the pill, e.g. `3 blocks`. */
  sublabel: string
  /** Short heading, e.g. "Round 1". */
  title: string
  /** The explanation sentence(s). */
  text: string
  /** The partition after this step, on the working DFA; `null` before round 0. */
  blocks: string[][] | null
  /** Colour index of each block in `blocks`. */
  colors: number[]
  /** Splits made in this round (rounds ≥ 1 only). */
  splits: SplitView[]
}

/** The complete walkthrough for one DFA. */
export interface MinimizeView {
  /** The DFA as given (e.g. the converted DFA, with or without ∅). */
  input: DFA
  /**
   * The DFA drawn during the walkthrough: every input state plus the added
   * dead state, if any. Reachable states have their completed transitions;
   * unreachable ones keep their own.
   */
  work: DFA
  result: MinimizeResult
  steps: MinStep[]
  /** States that cannot be reached from the start state. */
  removed: string[]
  /** The dead state added to make the DFA complete, or `null`. */
  addedDead: string | null
  /** True when no two states merge (unreachable removal and completion aside). */
  alreadyMinimal: boolean
  /** Groups of two or more states that merge, with their new name. */
  merged: { group: string[]; name: string }[]
  /** Too large to draw: show rounds as tables only, no layout or animation. */
  large: boolean
  /** Colour index of each state of the minimal DFA (same as its block's colour in the last round). */
  minColors: Record<string, number>
}

/**
 * The shortest string that distinguishes two states of a complete DFA, by
 * breadth-first search over state pairs.
 *
 * @param dfa - A DFA; missing transitions are treated as rejecting.
 * @param p - One state.
 * @param q - Another state.
 * @returns The string as a symbol list, or `null` if the states are equivalent.
 * @throws Never throws.
 */
export function distinguishingWord(dfa: DFA, p: string, q: string): string[] | null {
  const finals = new Set(dfa.finals)
  const isFinal = (s: string | undefined) => s !== undefined && finals.has(s)
  const key = (a: string | undefined, b: string | undefined) => `${a ?? '\u0000'}\u0001${b ?? '\u0000'}`
  const seen = new Set([key(p, q)])
  const queue: { a: string | undefined; b: string | undefined; word: string[] }[] = [{ a: p, b: q, word: [] }]
  for (let i = 0; i < queue.length; i++) {
    const { a, b, word } = queue[i]
    if (isFinal(a) !== isFinal(b)) return word
    for (const sym of dfa.alphabet) {
      const na = a === undefined ? undefined : dfa.transitions[a]?.[sym]
      const nb = b === undefined ? undefined : dfa.transitions[b]?.[sym]
      const k = key(na, nb)
      if (seen.has(k)) continue
      seen.add(k)
      queue.push({ a: na, b: nb, word: [...word, sym] })
    }
  }
  return null
}

/**
 * Shows a symbol list as a string: symbols joined directly when every symbol
 * is one character, otherwise with spaces; `ε` for the empty list.
 *
 * @param word - The symbols.
 * @param alphabet - The alphabet (decides whether spaces are needed).
 * @returns The display string.
 * @throws Never throws.
 */
export function showWord(word: readonly string[], alphabet: readonly string[]): string {
  if (word.length === 0) return 'ε'
  return word.join(alphabet.every((s) => [...s].length === 1) ? '' : ' ')
}

/** Longest set or list written out in full in a large DFA's explanations. */
export const BRIEF_MAX = 6

/**
 * Writes a set in braces, shortened for large DFAs: past {@link BRIEF_MAX}
 * members only the first few are listed, e.g. `{A,B,C,D,… 2048 states}`.
 *
 * @param xs - The members.
 * @param brief - Shorten long sets.
 * @returns The text.
 * @throws Never throws.
 */
export function setText(xs: readonly string[], brief = false): string {
  return brief && xs.length > BRIEF_MAX ? `{${xs.slice(0, 4).join(',')},… ${xs.length} states}` : formatSet(xs)
}

const listOf = (xs: readonly string[], brief = false) => (brief && xs.length > BRIEF_MAX ? `${xs.slice(0, 4).join(', ')} and ${xs.length - 4} more` : xs.join(', '))
const list = (xs: readonly string[]) => listOf(xs)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Builds the working DFA: input states plus the added dead state, transitions completed for reachable states. */
function workingDFA(input: DFA, removed: readonly string[], addedDead: string | null): DFA {
  const unreachable = new Set(removed)
  const declared = new Set(input.states)
  const states = addedDead ? [...input.states, addedDead] : [...input.states]
  const transitions: DFA['transitions'] = {}
  for (const s of input.states) {
    transitions[s] = {}
    for (const sym of input.alphabet) {
      const t = input.transitions[s]?.[sym]
      if (unreachable.has(s)) {
        if (t !== undefined && declared.has(t)) transitions[s][sym] = t
      } else if (t !== undefined && declared.has(t) && !unreachable.has(t)) transitions[s][sym] = t
      else if (addedDead) transitions[s][sym] = addedDead
    }
  }
  if (addedDead) transitions[addedDead] = Object.fromEntries(input.alphabet.map((sym) => [sym, addedDead]))
  const subsets = { ...input.subsets }
  if (addedDead) subsets[addedDead] = []
  return { ...input, states, transitions, subsets, deadState: addedDead ?? input.deadState }
}

/**
 * Explains one split: names the symbol(s) and, for each part, where its
 * members go, using the previous round's blocks.
 */
function explainSplit(split: PartitionSplit, prev: string[][], work: DFA, round: number, finals: ReadonlySet<string>, searchWitness: boolean): SplitView {
  const brief = !searchWitness
  const blockOf = new Map<string, number>()
  prev.forEach((b, i) => b.forEach((s) => blockOf.set(s, i)))
  const ownBlock = blockOf.get(split.group[0]) as number
  const target = (s: string, sym: string) => work.transitions[s]?.[sym] as string
  const targetBlock = (s: string, sym: string) => blockOf.get(target(s, sym)) as number

  // The symbols needed to separate the parts: start with the core's symbol, add more only if needed.
  const symbols = [split.symbol]
  const keyOf = (s: string) => symbols.map((sym) => targetBlock(s, sym)).join(',')
  const distinct = () => new Set(split.group.map(keyOf)).size
  for (const sym of work.alphabet) {
    if (distinct() >= split.into.length) break
    if (symbols.includes(sym)) continue
    const before = distinct()
    symbols.push(sym)
    if (distinct() === before) symbols.pop()
  }

  const label = (block: number, own: boolean) => {
    if (round === 1) {
      const name = finals.has(prev[block][0]) ? 'final block' : 'non-final block'
      return own ? `the ${name}` : name
    }
    return own ? setText(prev[block], brief) : `block ${setText(prev[block], brief)}`
  }

  const describe = (sym: string) => {
    const byBlock = new Map<number, string[]>()
    for (const s of split.group) {
      const b = targetBlock(s, sym)
      const members = byBlock.get(b)
      if (members) members.push(s)
      else byBlock.set(b, [s])
    }
    const moved: string[] = []
    let stay = ''
    for (const [b, members] of byBlock) {
      if (b === ownBlock) stay = `${listOf(members, brief)} stay${members.length === 1 ? 's' : ''} in ${label(b, true)}`
      else {
        const moves = members.map((s) => `${s} → ${target(s, sym)}`)
        moved.push(`${listOf(moves, brief)} (${label(b, false)})`)
      }
    }
    return [...moved, ...(stay ? [stay] : [])].join(', ')
  }

  const text =
    symbols.length === 1
      ? `${setText(split.group, brief)} splits on ${symbols[0]}: ${describe(symbols[0])}.`
      : `${setText(split.group, brief)} splits on ${symbols.join(' and ')}: ${symbols.map((sym) => `on ${sym}, ${describe(sym)}`).join('; ')}.`

  const edges = symbols.flatMap((sym) => split.group.map((s) => ({ from: s, symbol: sym, to: target(s, sym) })))

  // The part holding the group's first member keeps the block's colour; the others move.
  const keep = split.into.find((p) => p.includes(split.group[0])) ?? split.into[0]
  const moved = split.group.filter((s) => !keep.includes(s))

  let witness: SplitView['witness'] = null
  if (searchWitness && moved.length > 0) {
    const a = keep[0]
    const b = moved[0]
    const word = distinguishingWord(work, a, b)
    if (word) {
      let x: string | undefined = a
      for (const sym of word) x = x === undefined ? undefined : work.transitions[x]?.[sym]
      const aAccepts = x !== undefined && finals.has(x)
      witness = { word, accepting: aAccepts ? a : b, rejecting: aAccepts ? b : a }
    }
  }
  return { group: split.group, symbols, into: split.into, text, edges, moved, witness }
}

/**
 * Builds the Minimize tab's walkthrough of a DFA.
 *
 * Steps, in order:
 * 1. `unreachable` (round −1): states the start cannot reach are removed, or "none".
 * 2. `complete`: a dead state is added if the DFA is partial, with the reason.
 * 3. `round` 0: the blocks F and Q−F.
 * 4. `round` k ≥ 1: each block that splits, the symbol it splits on and
 *    where each member goes (the witness), and a distinguishing string.
 * 5. `stable`: the round where nothing splits; the partition is final.
 * 6. `done`: the merged states and the before/after state counts.
 *
 * Block colours are stable: a block keeps its colour while it exists; when
 * it splits, the part holding its first member keeps the colour and each
 * new part takes the next unused colour.
 *
 * @param input - The DFA to minimise (complete or partial). Not modified.
 * @returns The walkthrough. Distinguishing strings are left out for DFAs
 *   too large to draw (see `isTooLargeToDraw`), where the search over state
 *   pairs would be slow.
 * @throws Never throws for a well-formed DFA.
 */
export function buildMinimizeView(input: DFA): MinimizeView {
  const result = minimizeDFA(input)
  const removed = result.removedUnreachable
  const completeStep = result.steps.find((s) => s.kind === 'complete')
  const addedDead = completeStep && completeStep.kind === 'complete' ? completeStep.deadState : null
  const missing = completeStep && completeStep.kind === 'complete' ? completeStep.added : []
  const work = workingDFA(input, removed, addedDead)
  const large = isTooLargeToDraw(Math.max(work.states.length, result.dfa.states.length))
  const finals = new Set(input.finals)
  const steps: MinStep[] = []

  steps.push({
    kind: 'unreachable',
    round: -1,
    pill: '−1',
    sublabel: removed.length === 0 ? 'none' : `−${removed.length}`,
    title: 'Round −1 · unreachable states',
    text:
      removed.length === 0
        ? `Every state can be reached from the start state ${input.start}, so none is removed.`
        : `${list(removed)} cannot be reached from the start state ${input.start}, so ${removed.length === 1 ? 'it is' : 'they are'} removed: no input string ever visits ${removed.length === 1 ? 'it' : 'them'}.`,
    blocks: null,
    colors: [],
    splits: [],
  })

  const example = missing[0]
  steps.push({
    kind: 'complete',
    round: null,
    pill: '∅',
    sublabel: addedDead ? '+ dead' : 'complete',
    title: 'Completion',
    text: addedDead
      ? `The DFA is partial: ${plural(missing.length, 'move')} ${missing.length === 1 ? 'is' : 'are'} missing (e.g. ${example.from} on ${example.symbol}). Dead state ${addedDead} is added and every missing move goes there, because refinement compares where each state goes on every symbol.`
      : input.deadState && work.states.includes(input.deadState) && !removed.includes(input.deadState)
        ? `The DFA is complete: every state has a move on every symbol (the dead state ${input.deadState} already collects the moves to the empty set).`
        : 'The DFA is complete: every state has a move on every symbol, so no dead state is needed.',
    blocks: null,
    colors: [],
    splits: [],
  })

  const rounds = result.steps.filter((s) => s.kind === 'partition')
  const colorOf = new Map<string, number>()
  let nextColor = 0
  let prev: string[][] = []
  for (const r of rounds) {
    if (r.kind !== 'partition') continue
    let splits: SplitView[] = []
    if (r.round === 0) {
      for (const b of r.partition) colorOf.set(formatSet(b), nextColor++)
    } else {
      splits = r.splits.map((sp) => explainSplit(sp, prev, work, r.round, finals, !large))
      for (const sp of splits) {
        const c = colorOf.get(formatSet(sp.group)) as number
        const keep = sp.into.find((p) => p.includes(sp.group[0])) ?? sp.into[0]
        for (const part of sp.into) colorOf.set(formatSet(part), part === keep ? c : nextColor++)
      }
    }
    const colors = r.partition.map((b) => colorOf.get(formatSet(b)) ?? 0)
    if (r.round === 0) {
      const finalBlocks = r.partition.filter((b) => finals.has(b[0]))
      const others = r.partition.filter((b) => !finals.has(b[0]))
      const parts = [
        finalBlocks.length > 0 ? `final ${finalBlocks.map((b) => setText(b, large)).join(' ')}` : 'no final states',
        others.length > 0 ? `non-final ${others.map((b) => setText(b, large)).join(' ')}` : 'no non-final states',
      ]
      steps.push({
        kind: 'round',
        round: 0,
        pill: 'R0',
        sublabel: plural(r.partition.length, 'block'),
        title: 'Round 0 · final and non-final',
        text: `Start with two blocks, final and non-final states: ${parts.join(' | ')}. The empty string ε already tells them apart: a final state accepts it, a non-final state does not.`,
        blocks: r.partition,
        colors,
        splits: [],
      })
    } else {
      steps.push({
        kind: 'round',
        round: r.round,
        pill: `R${r.round}`,
        sublabel: plural(r.partition.length, 'block'),
        title: `Round ${r.round}`,
        text:
          large && splits.length > 3
            ? `${splits.slice(0, 3).map((sp) => sp.text).join(' ')} ${splits.length - 3} more blocks also split (${plural(r.partition.length, 'block')} now).`
            : splits.map((sp) => sp.text).join(' '),
        blocks: r.partition,
        colors,
        splits,
      })
    }
    prev = r.partition
  }

  const last = steps[steps.length - 1]
  const stableRound = (last.round ?? 0) + 1
  const named = prev.map((b) => (b.length === 1 ? b[0] : setText(b, large)))
  const shown = large && named.length > BRIEF_MAX ? `${named.slice(0, 4).join(', ')}, … (${named.length} blocks)` : named.join(', ')
  steps.push({
    kind: 'stable',
    round: stableRound,
    pill: `R${stableRound}`,
    sublabel: 'stable',
    title: `Round ${stableRound} · stable`,
    text: `No block splits: in every block, all members go to the same blocks on every symbol. The partition is stable: ${shown} = ${plural(prev.length, 'state')}.`,
    blocks: prev,
    colors: last.colors,
    splits: [],
  })

  const merged = prev.filter((b) => b.length > 1).map((group) => ({ group, name: formatSet(group) }))
  const alreadyMinimal = merged.length === 0
  const before = input.states.length
  const after = result.dfa.states.length
  const extras = [
    removed.length > 0 ? `${list(removed)} ${removed.length === 1 ? 'was' : 'were'} removed as unreachable` : '',
    addedDead ? `dead state ${addedDead} was added to make it complete` : '',
  ].filter(Boolean)
  const extraText = extras.length > 0 ? ` (${extras.join('; ')})` : ''
  steps.push({
    kind: 'done',
    round: null,
    pill: 'Done',
    sublabel: `${before} → ${after}`,
    title: alreadyMinimal ? 'Already minimal' : 'Minimal DFA',
    text: alreadyMinimal
      ? `Already minimal: no two states are equivalent, so nothing merges. The minimal DFA has ${plural(after, 'state')}${extraText}.`
      : `${(large ? merged.slice(0, 4) : merged).map((m) => `${listOf(m.group, large)} merge into ${large ? setText(m.group, true) : m.name}`).join('; ')}${large && merged.length > 4 ? `; and ${merged.length - 4} more groups` : ''}. The minimal DFA has ${plural(after, 'state')}, down from ${before}${extraText}.`,
    blocks: prev,
    colors: last.colors,
    splits: [],
  })

  const minColors: Record<string, number> = {}
  prev.forEach((b, i) => {
    minColors[result.mapping[b[0]]] = last.colors[i]
  })

  return { input, work, result, steps, removed, addedDead, alreadyMinimal, merged, large, minColors }
}

/** One frame of a step's animation. */
export interface MinFrame {
  /** `show`: the step's state; `witness`: the splitting edges light up before the split; `split`: moved states take their new colour. */
  phase: 'show' | 'witness' | 'split'
  /** Base duration at 1× speed, in ms. */
  ms: number
}

/** Frame durations at 1× speed, in ms. */
export const MIN_FRAME_MS = { show: 1100, witness: 1200, split: 1300 } as const

/**
 * The animation frames of each step. Rounds with splits play the witness
 * (edges on the splitting symbol) and then the split; every other step is
 * one frame. Large DFAs get one frame per step and are never animated.
 *
 * @param view - The walkthrough.
 * @returns Frames per step.
 * @throws Never throws.
 */
export function planMinimize(view: MinimizeView): MinFrame[][] {
  return view.steps.map((s) =>
    s.kind === 'round' && s.splits.length > 0 && !view.large
      ? [
          { phase: 'witness', ms: MIN_FRAME_MS.witness },
          { phase: 'split', ms: MIN_FRAME_MS.split },
        ]
      : [{ phase: 'show', ms: MIN_FRAME_MS.show }],
  )
}

/** What the canvas shows at one point of the walkthrough. */
export interface MinCanvasState {
  /** States drawn on the working DFA. */
  visible: string[]
  /** States drawn faded (unreachable, about to be removed). */
  faded: string[]
  /** The state growing in (the added dead state). */
  entering: string | null
  /** Colour index per state, or nothing before round 0. */
  colorOf: Record<string, number>
  /** States ringed: the members of blocks that split in this round. */
  ringed: string[]
  /** Edges lit to show the split. */
  edges: WitnessEdge[]
  /** States that change colour in this frame (staggered). */
  moved: string[]
}

/**
 * The canvas state at a step and frame: which states show, their colours,
 * the ringed members and the lit edges. During the `witness` frame the
 * colours are still the previous round's, so the split happens visibly in
 * the `split` frame.
 *
 * @param view - The walkthrough.
 * @param stepIndex - Index into `view.steps` (clamped).
 * @param phase - The frame's phase.
 * @returns The canvas state.
 * @throws Never throws.
 */
export function canvasState(view: MinimizeView, stepIndex: number, phase: MinFrame['phase']): MinCanvasState {
  const i = Math.max(0, Math.min(view.steps.length - 1, stepIndex))
  const step = view.steps[i]
  const removed = new Set(view.removed)
  const kept = view.work.states.filter((s) => !removed.has(s) && s !== view.addedDead)
  const afterRemoval = view.addedDead ? [...kept, view.addedDead] : kept
  if (step.kind === 'unreachable') {
    return { visible: view.input.states, faded: view.removed, entering: null, colorOf: {}, ringed: [], edges: [], moved: [] }
  }
  if (step.kind === 'complete') {
    return { visible: afterRemoval, faded: [], entering: view.addedDead, colorOf: {}, ringed: [], edges: [], moved: [] }
  }
  const source = phase === 'witness' ? view.steps[i - 1] : step
  const colorOf: Record<string, number> = {}
  source.blocks?.forEach((b, k) => b.forEach((s) => (colorOf[s] = source.colors[k])))
  const ringed = step.splits.flatMap((sp) => sp.group)
  const edges = step.splits.flatMap((sp) => sp.edges)
  const moved = phase === 'split' ? step.splits.flatMap((sp) => sp.moved) : []
  return { visible: afterRemoval, faded: [], entering: null, colorOf, ringed: phase === 'show' ? [] : ringed, edges: phase === 'show' ? [] : edges, moved }
}

/**
 * Text of a partition for lists and tables, e.g. `{A,B,C,D} {E}`.
 *
 * @param blocks - The blocks.
 * @param max - Most blocks to list before "… and n more" (default: all).
 * @returns The text.
 * @throws Never throws.
 */
export function partitionText(blocks: readonly string[][], max = Infinity): string {
  const shown = blocks.slice(0, max).map(formatSet).join(' ')
  return blocks.length > max ? `${shown} … and ${blocks.length - max} more` : shown
}

/**
 * Checks that the minimal DFA accepts the same strings as the DFA it came
 * from, on every string up to a length bound.
 *
 * @param view - The walkthrough.
 * @param maxLen - Longest string tested (default 8).
 * @returns The core's bounded equivalence result.
 * @throws Never throws.
 */
export function minimizedEquivalence(view: MinimizeView, maxLen = 8): EquivalenceResult {
  return checkEquivalence(view.input, view.result.dfa, maxLen)
}

/**
 * One line for the equivalence result, e.g. "Equivalent: the DFA and the
 * minimal DFA agree on all 511 strings up to length 8."
 *
 * @param r - The result of {@link minimizedEquivalence}.
 * @param maxLen - The bound that was used.
 * @param alphabet - The alphabet, for showing a counterexample.
 * @returns The sentence.
 * @throws Never throws.
 */
export function equivalenceLine(r: EquivalenceResult, maxLen: number, alphabet: readonly string[]): string {
  if (!r.agree && r.counterexample) {
    const c = r.counterexample
    return `Not equivalent: on ${showWord(c.tokens, alphabet)} the DFA ${c.acceptedByA ? 'accepts' : 'rejects'} but the minimal DFA ${c.acceptedByB ? 'accepts' : 'rejects'}.`
  }
  return r.exhaustive
    ? `Equivalent: the DFA and the minimal DFA agree on all ${r.tested.toLocaleString()} strings up to length ${maxLen}.`
    : `Equivalent on the first ${r.tested.toLocaleString()} strings (shortest first); the length-${maxLen} search was capped.`
}

/**
 * The text shown inside a minimal-DFA state: its name if it is short,
 * otherwise its first member followed by "+"; the full name goes in the
 * caption.
 *
 * @param name - The minimal DFA state name, e.g. `{A,C}`.
 * @returns The circle label and the caption (or `undefined` when the label is the full name).
 * @throws Never throws.
 */
export function minStateLabel(name: string): { label: string; caption: string | undefined } {
  if ([...name].length <= 5) return { label: name, caption: undefined }
  const first = name.startsWith('{') ? name.slice(1).split(',')[0] : name.slice(0, 3)
  return { label: `${first}+`, caption: name }
}
