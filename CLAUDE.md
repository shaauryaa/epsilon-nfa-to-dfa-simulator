# Project rules

## Attribution (hard rule)

Every commit, tag, release, pull request and file in this repository must show
only the repository owner's name. Never add `Co-Authored-By` trailers,
"Generated with ..." lines, session links, or any mention of AI tools or their
vendors in commit messages, tags, release notes, PR descriptions or files.

Git identity for this repo:

- `user.name`  = `shauryaa`
- `user.email` = `178525033+shaauryaa@users.noreply.github.com`

A tracked `commit-msg` hook in `.githooks/` enforces this. After cloning, run:

```sh
git config core.hooksPath .githooks
```

## Folder layout

```
SourceCode/          Vite + React + TypeScript app
  src/core/          Pure automata algorithms (ε-closure, subset construction, minimization, simulation)
  src/components/    React UI components
  src/presets/       Example automata
  tests/             Vitest unit tests
TestCases/           Test case inputs and expected outputs
Screenshots/         Screenshots for the report and README
Report/              Project report
docs/                Additional documentation
.github/workflows/   CI: test, build, deploy to GitHub Pages
.githooks/           Tracked git hooks
```

## Code rules

- Code in `SourceCode/src/core` must stay free of UI code: no React, no DOM,
  no styling, no store imports. It must be pure TypeScript that can be unit
  tested in Node.
- Every exported function in `src/core` needs a doc comment covering its
  purpose, parameters, return value and any errors it throws.
- Run `npm test` and `npm run build` in `SourceCode/` before committing.
