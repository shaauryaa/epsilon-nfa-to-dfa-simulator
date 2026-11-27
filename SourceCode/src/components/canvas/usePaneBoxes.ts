import { useMemo } from 'react'
import type { DFA } from '../../core'
import { dfaCaptions, layoutDFA, roughBox } from '../../model/dfaLayout'
import { useApp } from '../../store/automaton'

/**
 * Size of the "DFA diagram hidden" notice that replaces a DFA too large to
 * draw, so the split treats it as a small drawing and gives a wide ε-NFA the
 * full width.
 */
const HIDDEN_DFA_BOX = { x: 0, y: 0, width: 440, height: 260 }

/**
 * Rough bounds of the ε-NFA and a DFA drawing, for choosing how the two
 * panes share the canvas.
 *
 * @param dfa - The DFA drawn in the second pane, `'hidden'` when the large-DFA notice replaces it, or `null` when unknown.
 * @returns The ε-NFA box and the second pane's box.
 */
export function usePaneBoxes(dfa: DFA | 'hidden' | null) {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const nfaBox = useMemo(() => roughBox(positions, nfa.start), [positions, nfa.start])
  const dfaBox = useMemo(() => (dfa === 'hidden' ? HIDDEN_DFA_BOX : dfa ? roughBox(layoutDFA(dfa), dfa.start, dfaCaptions(dfa)) : null), [dfa])
  return [nfaBox, dfaBox] as [typeof nfaBox, typeof dfaBox]
}
