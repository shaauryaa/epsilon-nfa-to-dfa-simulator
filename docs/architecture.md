# Architecture

The app is a single-page React + TypeScript site built with Vite. All automata algorithms live in a pure TypeScript core with no React, DOM or styling, so they are unit-tested in Node and reused by the UI, the PDF report and the test-report script.

## Data flow

```
 Builder / text editor / canvas / From regex / examples / import
                      │  edits produce a new ENFA value
                      ▼
            store/automaton.ts  (useApp)
     current ENFA, undo/redo history, node positions, active tab
                      │  derive(nfa)  (store/derive.ts)
                      ▼
                  src/core
   validateENFA → epsilonClosure → subsetConstruction → minimizeDFA
                 simulateENFA / simulateDFA / checkEquivalence
                      │  plain data: DFA, steps, rounds, traces
                      ▼
                  src/model
   animation plans (convertPlan, testPlan, minimizeView), layouts,
   SVG drawing, report sentences
                      │
                      ▼
   components: Define · Convert · Test · Minimize, Download menu, PDF
```

1. **Input.** Every editor (builder sections, text format, canvas, From regex, examples, import) builds a new `ENFA` object with the pure helpers in `model/edits.ts` or `core` and calls `commit(nfa, origin)` on the app store. The store keeps up to 50 snapshots for undo / redo and saves the machine to `localStorage`.
2. **Derive.** On each commit `store/derive.ts` validates the machine and, when it is valid, computes the ε-closures, the subset construction result (with and without the dead state) and the minimal DFA. Errors such as `StateLimitError` (more than 4096 DFA states) are caught and shown as messages.
3. **View models.** `src/model` turns core results into what the UI draws: one animation frame list per subset step, DFA layouts and captions, test runs, minimisation rounds. These are pure functions and tested.
4. **Views.** Each tab reads the store, runs its player (`store/player.ts` shared by Convert and Test, `store/minimize.ts` for Minimize) and renders React Flow graphs plus side panels. Downloads and the PDF report call `core/export.ts` and `lib/report.ts` with the same results.

## Modules

### `src/core` (pure algorithms)

| Module | Contents |
| --- | --- |
| `types.ts` | `ENFA`, `DFA`, `EPSILON` |
| `sets.ts` | Stable sorted sets of state names, `formatSet` |
| `automaton.ts` | Validation (`validateENFA`), the text format (`parseText`, `toText`), JSON (`toJSON`, `fromJSON`) |
| `closure.ts` | `epsilonClosure`, `move` |
| `subset.ts` | `subsetConstruction` with recorded steps, dead state, `MAX_DFA_STATES` = 4096 |
| `minimize.ts` | `minimizeDFA`: Moore partition refinement with recorded rounds |
| `simulate.ts` | `tokenize`, `simulateENFA`, `simulateDFA` |
| `equivalence.ts` | `allStrings`, bounded `checkEquivalence` |
| `regex.ts` | `parseRegex` (recursive descent), `thompson`, `regexToENFA`, `RegexSyntaxError` |
| `import.ts` / `export.ts` | JSON, JFLAP, text import; JFLAP, JSON, text, DOT, CSV, Python and JavaScript export |

### `src/model` (view logic, no React)

`convertPlan.ts` (micro-steps of one subset step), `testPlan.ts` and `testRun.ts` (Test tab), `minimizeView.ts` (Minimize tab), `dfaLayout.ts`, `graph.ts`, `viewport.ts`, `largeDfa.ts` (60-state drawing limit), `svg.ts`, `reportText.ts`, `edits.ts`, `issues.ts`.

### `src/store` (Zustand)

`automaton.ts` (machine, history, positions, tab), `derive.ts`, `convert.ts`, `test.ts`, `minimize.ts`, `player.ts`, `panes.ts`, `toasts.ts`, `docs.ts`.

### `src/components`

`builder/` (From regex, states, alphabet, transitions, table, text editor), `canvas/` (React Flow graph and parts), `convert/`, `test/`, `minimize/`, `ui/` (buttons, dialogs, popovers, toasts, icons), plus `Navbar`, `BottomPanel` (step timeline), `InfoDialogs` (Docs and About), `DownloadMenu` and `ErrorBoundary`.

### Other

`src/graph` (dagre layout, edge routing), `src/lib` (PDF report, downloads, crash recovery), `src/presets` (example machines with expected results).

## Testing layers

- `tests/`: Vitest unit and property tests for the core and the model.
- `e2e/`: Playwright tests against the production build; any console error fails a test.
- `scripts/test-report.ts`: runs the examples in `TestCases/` and writes `results.csv` and `results.md`. CI fails if the committed results differ.
