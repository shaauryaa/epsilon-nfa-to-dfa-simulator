import { useMemo } from 'react'
import type { DFA } from '../../core'
import { dfaCaptions, layoutDFA, roughBox } from '../../model/dfaLayout'
import { useApp } from '../../store/automaton'

/** Rough bounds of the ε-NFA and a DFA drawing, for choosing how the two panes share the canvas. */
export function usePaneBoxes(dfa: DFA | null) {
  const nfa = useApp((s) => s.nfa)
  const positions = useApp((s) => s.positions)
  const nfaBox = useMemo(() => roughBox(positions, nfa.start), [positions, nfa.start])
  const dfaBox = useMemo(() => (dfa ? roughBox(layoutDFA(dfa), dfa.start, dfaCaptions(dfa)) : null), [dfa])
  return [nfaBox, dfaBox] as [typeof nfaBox, typeof dfaBox]
}

