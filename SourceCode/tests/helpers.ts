import { EPSILON, type ENFA } from '../src/core/types'

/** Mulberry32: a small, fast, seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Builds a random valid ε-NFA over {a, b} with 2–6 states. */
export function randomENFA(rand: () => number): ENFA {
  const n = 2 + Math.floor(rand() * 5)
  const states = Array.from({ length: n }, (_, i) => `s${i}`)
  const transitions: ENFA['transitions'] = {}
  for (const s of states) {
    for (const sym of ['a', 'b', EPSILON]) {
      const density = sym === EPSILON ? 0.15 : 0.3
      const targets = states.filter(() => rand() < density)
      if (targets.length > 0) (transitions[s] ??= {})[sym] = targets
    }
  }
  const finals = states.filter(() => rand() < 0.3)
  return { states, alphabet: ['a', 'b'], start: states[0], finals, transitions }
}

/**
 * The classic 2ⁿ blow-up: "the k-th symbol from the end is a" over {a, b}.
 * k + 1 NFA states; the DFA needs 2^k states.
 */
export function kthFromEnd(k: number): ENFA {
  const states = Array.from({ length: k + 1 }, (_, i) => `q${i}`)
  const transitions: ENFA['transitions'] = { q0: { a: ['q0', 'q1'], b: ['q0'] } }
  for (let i = 1; i < k; i++) transitions[`q${i}`] = { a: [`q${i + 1}`], b: [`q${i + 1}`] }
  return { states, alphabet: ['a', 'b'], start: 'q0', finals: [`q${k}`], transitions }
}
