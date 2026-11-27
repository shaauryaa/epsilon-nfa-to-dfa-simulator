/**
 * Plans the Test tab's animation: step 0 is the start (the ε-closure of the
 * start state spreads), then one step per input symbol. Each step is a short
 * list of frames, and each frame is a full snapshot of both graphs, using
 * the same frame model and closure spreading as the Convert tab.
 */

import { formatSet, type ENFA } from '../core'
import { closureFrames, FRAME_MS, moveEdges, type Frame } from './convertPlan'
import type { RunTrace } from './testRun'

/** One frame of a run: the ε-NFA part (as in Convert) plus the DFA part. */
export interface RunFrame extends Frame {
  /** ε-NFA states whose branch dies on this symbol (no edge for it): drawn faded. */
  faded: string[]
  /** The DFA state drawn as current; `null` once a partial DFA has stopped. */
  dfaCurrent: string | null
  /** The DFA edge taken by this step, drawn lit. */
  dfaEdge: { from: string; symbol: string; to: string } | null
  /** True on the frame where a token travels along `dfaEdge`. */
  dfaToken: boolean
}

const blank = (): Omit<RunFrame, 'phase' | 'text' | 'ms'> => ({
  current: [],
  moved: [],
  closure: [],
  symbolEdges: [],
  epsilonEdges: [],
  tokens: false,
  pulse: false,
  revealed: true,
  filled: true,
  faded: [],
  dfaCurrent: null,
  dfaEdge: null,
  dfaToken: false,
})

function verdictText(trace: RunTrace, nfa: ENFA): string {
  const finals = new Set(nfa.finals)
  const hit = trace.nfa.final.filter((s) => finals.has(s))
  const n = trace.nfaAccepted
    ? `${formatSet(trace.nfa.final)} contains final state${hit.length > 1 ? 's' : ''} ${hit.join(', ')}, so the ε-NFA accepts`
    : trace.nfa.final.length === 0
      ? 'the ε-NFA has no active states left, so it rejects'
      : `${formatSet(trace.nfa.final)} has no final state, so the ε-NFA rejects`
  const last = trace.dfa.path[trace.dfa.path.length - 1]
  const d =
    trace.dfaStuckAt !== null
      ? 'the DFA stopped on a missing move, so it rejects'
      : `${last} is ${trace.dfaAccepted ? 'final, so the DFA accepts' : 'not final, so the DFA rejects'}`
  return `End of input: ${n}; ${d}.`
}

/**
 * Plans every step of a run.
 *
 * - Step 0: the start state pulses, its ε-closure spreads along ε-edges,
 *   and the DFA sits on its start state.
 * - Step i (symbol a): tokens carry a along every a-edge out of the current
 *   set and along the DFA's edge at the same time, while branches with no
 *   a-edge fade; the ε-closure of the targets spreads; the step settles on
 *   the new set and the new DFA state.
 * The last frame of the last step states the verdict.
 *
 * @param nfa - The ε-NFA that ran.
 * @param trace - From `buildTrace`.
 * @returns `trace.steps.length + 1` frame lists; the last frame of each is the completed step.
 * @throws Never throws.
 */
export function planRun(nfa: ENFA, trace: RunTrace): RunFrame[][] {
  const plan: RunFrame[][] = []
  const startDfa = trace.dfa.path[0]
  const seeds = [nfa.start]
  const pulse: RunFrame = {
    ...blank(),
    phase: 'pulse',
    current: seeds,
    closure: seeds,
    pulse: true,
    dfaCurrent: startDfa,
    text: `Start: the ε-NFA begins in ${nfa.start}; the DFA begins in ${startDfa}.`,
    ms: FRAME_MS.pulse,
  }
  const spread = closureFrames(nfa, seeds, { ...blank(), current: seeds, dfaCurrent: startDfa }, trace.nfa.initial)
  const settle0: RunFrame = {
    ...blank(),
    phase: 'done',
    current: trace.nfa.initial,
    dfaCurrent: startDfa,
    text: `Before any input the ε-NFA is in ε-closure(${nfa.start}) = ${formatSet(trace.nfa.initial)}, the DFA in ${startDfa}.`,
    ms: FRAME_MS.cell,
  }
  plan.push([pulse, ...spread, settle0])

  for (const s of trace.steps) {
    const edges = moveEdges(nfa, s.nfaBefore, s.symbol)
    const sources = new Set(edges.map(([f]) => f))
    const faded = s.nfaBefore.filter((x) => !sources.has(x))
    const dfaEdge = s.dfaFrom !== null && s.dfaTo !== null ? { from: s.dfaFrom, symbol: s.symbol, to: s.dfaTo } : null
    const dfaText =
      s.dfaFrom === null ? 'The DFA has already stopped.' : s.dfaTo === null ? `The DFA has no ${s.symbol}-move from ${s.dfaFrom}: it stops and rejects.` : `DFA: ${s.dfaFrom} —${s.symbol}→ ${s.dfaTo}.`
    const nfaText =
      edges.length === 0
        ? `No ${s.symbol}-edges leave ${formatSet(s.nfaBefore)}: every branch dies.`
        : `Read ${s.symbol}: follow the ${s.symbol}-edges out of ${formatSet(s.nfaBefore)} to ${formatSet(s.nfaMoved)}.`
    const move: RunFrame = {
      ...blank(),
      phase: 'move',
      current: s.nfaBefore,
      moved: s.nfaMoved,
      symbolEdges: edges,
      tokens: edges.length > 0,
      faded,
      dfaCurrent: s.dfaFrom,
      dfaEdge,
      dfaToken: dfaEdge !== null,
      text: `${nfaText} ${dfaText}`,
      ms: edges.length > 0 || dfaEdge ? FRAME_MS.move : FRAME_MS.pulse,
    }
    const frames: RunFrame[] = [move]
    const arrived = { ...blank(), moved: s.nfaMoved, symbolEdges: edges, faded, dfaCurrent: s.dfaTo, dfaEdge }
    if (s.nfaMoved.length > 0) frames.push(...closureFrames(nfa, s.nfaMoved, arrived, s.nfaAfter))
    frames.push({
      ...blank(),
      phase: 'done',
      current: s.nfaAfter,
      dfaCurrent: s.dfaTo,
      dfaEdge,
      text:
        s.nfaAfter.length === 0
          ? `After ${s.symbol} the ε-NFA has no active states (∅)${s.dfaTo ? `; the DFA is in ${s.dfaTo}` : ''}.`
          : `After ${s.symbol} the ε-NFA is in ${formatSet(s.nfaAfter)}${s.dfaTo ? `, the DFA in ${s.dfaTo}` : ''}.`,
      ms: FRAME_MS.cell,
    })
    plan.push(frames)
  }

  const last = plan[plan.length - 1]
  const end = last[last.length - 1]
  last[last.length - 1] = { ...end, text: `${end.text} ${verdictText(trace, nfa)}` }
  return plan
}
