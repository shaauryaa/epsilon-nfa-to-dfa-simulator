# Demo script (5 minutes)

Open the live site at 1366×768 or larger: https://shaauryaa.github.io/epsilon-nfa-to-dfa-simulator/

## 0:00 – Introduction (20 s)

"This tool converts an ε-NFA to a DFA with subset construction, shows each step, tests strings and minimises the DFA. There are four modes: Define, Convert, Test and Minimize."

## 0:20 – Build a small ε-NFA from scratch (60 s)

1. Navbar → **New** (blank machine).
2. **States:** add `q0`, `q1`, `q2`. Set start `q0`, mark `q2` final.
3. **Alphabet:** add `a`, `b`.
4. **Add transition:** `q0 a q0`, `q0 ε q1` (use the ε button), `q1 b q1`, `q1 ε q2`.
5. Point out the live graph and the green "Valid ε-NFA" banner. Briefly add a transition to an undeclared state to show the red validation message, then press **Ctrl+Z**.

"This machine accepts a*b*."

## 1:20 – From regex (30 s)

1. In **From regex** type `(a|b)*abb` and press **Build**.
2. "Thompson's construction gives the textbook 11-state machine, states 0 to 10. The Undo button in the toast brings back the previous machine."

## 1:50 – Convert, step by step (70 s)

1. **Convert** tab. Press **Step forward** a few times:
   - start: A = ε-closure({0}) = {0,1,2,4,7};
   - A on a: move(A, a) = {3, 8}, closure {1,2,3,4,6,7,8} = B (new).
2. Point at the animation (set T, tokens on a-edges, closure spreading) and the DFA growing on the other pane.
3. Open **Working table** in the side panel: one row per step, T | a | move | ε-closure | DFA state new / existing.
4. **Skip to the end**: 5 states A–E, E final. Mention the dead-state ∅ toggle.

## 3:00 – Test (50 s)

1. **Test** tab. Type `abb`: both machines say **ACCEPTED**; play to show the tape and traces.
2. Type `ab`: **REJECTED** by both.
3. Type `abc`: "“c” (symbol 3) is not in Σ" — an invalid input, not a rejection.
4. **Batch test** → **Load expected strings** → **Run**: every row PASS for ε-NFA, DFA and minimal DFA.

## 3:50 – Minimize (40 s)

1. **Minimize** tab. Step through: round 0 {E} | {A,B,C,D}; D splits on b; B splits on b; stable.
2. Final view: 4 states, {A,C}, B, D, E; equivalence check passes.

## 4:30 – Downloads (30 s)

1. **Download DFA** → JFLAP `.jff` (opens in JFLAP) or JSON.
2. Navbar **Download** → **Download full report (PDF)**: 5-tuple, ε-closures, working table, DFA, minimisation and test results.

"All algorithms are pure TypeScript with 507 unit and property tests and 30 browser tests, run in CI on every push."
