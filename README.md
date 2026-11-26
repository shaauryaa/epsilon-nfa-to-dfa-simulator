# Project title

**ε-NFA to DFA Simulator**

Course: CSET302 Automata Theory and Computability, Bennett University

**Live demo:** https://shaauryaa.github.io/epsilon-nfa-to-dfa-simulator/

## Overview

An interactive web tool that converts an ε-NFA into an equivalent DFA. It computes ε-closures, walks through the subset construction step by step, minimizes the resulting DFA, and tests input strings against the automata. *(Details to be added.)*

## Supported features

- Define an ε-NFA (states, alphabet, transitions, start and accept states)
- ε-closure computation
- Step-by-step subset construction (ε-NFA → DFA)
- DFA minimization
- String acceptance testing
- Graph visualization of the automata
- Preset example automata

*(Placeholder list; will be updated as features land.)*

## Technology stack and dependencies

| Package | Version |
| --- | --- |
| React / React DOM | ^19.3.1 |
| TypeScript | ~7.0.2 |
| Vite | ^8.4.0 |
| Tailwind CSS | ^4.3.5 |
| React Flow (`reactflow`) | ^11.11.4 |
| dagre | ^0.8.5 |
| Zustand | ^5.1.0 |
| Vitest | ^5.1.2 |

Requires Node.js 20 or newer (CI uses Node 24).

## Installation

```sh
git clone https://github.com/shaauryaa/epsilon-nfa-to-dfa-simulator.git
cd epsilon-nfa-to-dfa-simulator/SourceCode
npm install
```

## How to run

From `SourceCode/`:

```sh
npm run dev       # start the dev server
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Example

*(Placeholder: a worked example with an ε-NFA, its DFA and screenshots will be added here.)*

## Project structure

```
SourceCode/          Vite + React + TypeScript app
  src/core/          Automata algorithms (UI-free)
  src/components/    React UI components
  src/presets/       Example automata
  tests/             Vitest unit tests
TestCases/           Test case inputs and expected outputs
Screenshots/         Screenshots
Report/              Project report
docs/                Additional documentation
```

## Testing

From `SourceCode/`:

```sh
npm test
```

Tests also run on every push to `main` via GitHub Actions before deployment. *(Test coverage details to be added.)*

## Known limitations and troubleshooting

*(Placeholder: to be filled in as the project develops.)*

- If the deployed page is blank, check that the Vite `base` path matches the repository name.

## Team contributions and acknowledgements

| Name | Enrollment No. | Contributions |
| --- | --- | --- |
| Shaurya Nigam | S24CSEU0497 | *(to be added)* |
| Vishnu Verma | S24CSEU2382 | *(to be added)* |

Course: CSET302 Automata Theory and Computability, Bennett University.

Licensed under the [MIT License](LICENSE).
