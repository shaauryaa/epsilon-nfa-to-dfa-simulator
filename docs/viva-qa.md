# Viva questions and model answers

**1. What is an ε-NFA?**
A 5-tuple (Q, Σ, δ, q₀, F) with δ : Q × (Σ ∪ {ε}) → 𝒫(Q). It may move to several states on one symbol, or move on ε without reading input. It accepts w if some path reading w ends in a final state.

**2. What is the ε-closure of a state, and how do you compute it?**
All states reachable using only ε-moves, including the state itself. We use a depth-first search over ε-edges with a visited set, so each state and ε-edge is handled once: O(V + E). For a set T, ε-closure(T) is the union of the closures.

**3. What is move(T, a)?**
The set of states reached from any state in T by one a-transition, before ε-moves. The next DFA state is ε-closure(move(T, a)).

**4. Why are DFA states sets of NFA states?**
After reading a prefix, the NFA can be in several states at once. The DFA tracks that whole set as one state, so it is deterministic: for each set and symbol there is exactly one next set.

**5. Describe subset construction.**
Start with A = ε-closure({q₀}). For each unmarked set T and each symbol a, compute U = ε-closure(move(T, a)); add U if it is new; set Dtran[T, a] = U. A set is final if it contains an NFA final state. Stop when every set is marked.

**6. What is the dead state?**
When move(T, a) is empty the DFA goes to ∅, a non-final state that loops to itself on every symbol. It makes δ total. Without it the DFA is partial and a missing move means reject; both accept the same language. Our toggle shows both.

**7. Why can the DFA have 2ⁿ states? Give an example.**
Each DFA state is a subset of Q, and there are 2ⁿ subsets. "The k-th symbol from the end is a" needs k + 1 NFA states but 2ᵏ DFA states, because the DFA must remember the last k symbols and no two of those states are equivalent. Our 13-state example gives 4096 DFA states.

**8. How do you keep large cases from freezing the browser?**
Only reachable subsets are built; construction stops past 4096 DFA states with a clear message; above 60 DFA states we show tables instead of diagrams and animation.

**9. How does minimisation work?**
Moore's partition refinement: remove unreachable states, complete the DFA with ∅ if needed, start with {F, Q − F}, and split a block whenever its states go to different blocks on some symbol. When a round splits nothing, each block is one state of the minimal DFA. O(n² · |Σ|).

**10. Why is the minimised DFA correct and minimal?**
States are split only when some string distinguishes them, and after a stable round no string can distinguish two states in the same block. So the blocks are the Myhill–Nerode equivalence classes; the minimal DFA is unique up to renaming. For (a|b)*abb, A and C merge, giving 4 states.

**11. What are Thompson's construction rules?**
Symbol a: i –a→ f. ε: i –ε→ f. Union s|t: new i with ε to both starts, both ends ε to a new f. Concatenation st: the end of s is the start of t. Star s*: new i and f; i –ε→ start(s) and f; end(s) –ε→ start(s) and f. Each fragment has one start with no incoming edges and one final with no outgoing edges, so it uses at most 2m states for a regex of length m.

**12. How does your regex parser handle precedence?**
Recursive descent with one function per level: union calls concat, concat calls postfix, postfix calls atom. So * and ? bind tighter than concatenation, which binds tighter than | (or +). Errors give a 1-based position.

**13. What is the complexity of your algorithms?**
ε-closure O(V + E); subset construction O(2ⁿ · |Σ| · n²) in the worst case but usually far less, since only reachable sets are built; minimisation O(n² · |Σ|); DFA simulation O(|w|); ε-NFA simulation O(|w| · (V + E)).

**14. How did you test it?**
507 Vitest unit and property tests: textbook tables, ε-cycles, dead states, 500 random ε-NFAs where the ε-NFA, DFA and minimal DFA agree on all strings up to length 6, and 150 random regexes where our Thompson ε-NFA agrees with JavaScript RegExp. 30 Playwright browser tests on the production build, and a test report of 372 cases in TestCases/. CI runs all of them on every push.

**15. What are the limitations?**
Multi-character symbols use a greedy tokenizer without backtracking; DFAs above 60 states are shown as tables only; construction stops at 4096 states; regex symbols are single characters a–z and 0–9; JFLAP positions are not applied on import.
