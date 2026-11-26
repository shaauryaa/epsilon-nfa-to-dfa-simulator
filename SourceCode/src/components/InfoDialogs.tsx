import type { ReactNode } from 'react'
import { Dialog } from './ui/Dialog'

const kbd = 'rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700'
const eps = 'font-mono text-violet-700'

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Add states',
    body: (
      <>
        Type a name under <strong>States</strong> (or leave it blank for the next name), press the + button at the
        transition table’s last row, click <strong>State</strong> on the canvas, or double-click the canvas.
      </>
    ),
  },
  {
    title: 'Choose the start and final states',
    body: (
      <>
        Pick the one start state from the <strong>Start state</strong> menu and click state chips under{' '}
        <strong>Final states</strong> to toggle them. You can also right-click a state on the canvas.
      </>
    ),
  },
  {
    title: 'Add transitions',
    body: (
      <>
        Use the <strong>Add transition</strong> form (several symbols as <span className="font-mono">a,b</span>, an
        ε-move as <span className={eps}>ε</span> or <span className={eps}>eps</span>), drag from a state’s blue dot to
        another state, or click a cell of the transition table and pick target states.
      </>
    ),
  },
  {
    title: 'Read the transition table',
    body: (
      <>
        Each cell is δ(state, symbol), the set of next states; ∅ means no transition. → marks the start state and *
        marks final states. Hover a cell to highlight it on the canvas.
      </>
    ),
  },
  {
    title: 'Fix problems',
    body: (
      <>
        The banner at the top of the builder says whether the machine is a valid ε-NFA. Errors (red) must be fixed
        before conversion; warnings (amber) are allowed. Click a problem in the right sidebar to jump to it.
      </>
    ),
  },
  {
    title: 'Convert, test and minimize',
    body: <>Switch modes in the top bar. The builder stays on the left so you can edit at any time.</>,
  },
]

/** How to use the studio: numbered steps, the text format and shortcuts. */
export function DocsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Documentation">
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="mt-4">
        <h3 className="mb-1.5 text-sm font-semibold text-slate-900">Text format</h3>
        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800">
          {`states: q0 q1 q2
alphabet: a b
start: q0
final: q2
q0 a -> q0 q1     # several targets
q1 eps -> q2      # ε-move (eps, epsilon or ε)`}
        </pre>
      </section>
      <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
        <strong>Shortcuts:</strong> <kbd className={kbd}>Ctrl</kbd> + <kbd className={kbd}>Z</kbd> undo ·{' '}
        <kbd className={kbd}>Ctrl</kbd> + <kbd className={kbd}>Y</kbd> redo · <kbd className={kbd}>←</kbd>{' '}
        <kbd className={kbd}>→</kbd> switch modes · double-click the canvas to add a state. Your machine is kept in this
        browser between visits.
      </p>
    </Dialog>
  )
}

const TOPICS = [
  {
    title: 'What is an ε-NFA?',
    body: 'A nondeterministic finite automaton with ε-moves is a 5-tuple M = (Q, Σ, δ, q₀, F) with δ : Q × (Σ ∪ {ε}) → 𝒫(Q). From a state it may move on a symbol to any of several states, or move on ε without reading input. It accepts a string if some path ends in a final state.',
  },
  {
    title: 'ε-closure',
    body: 'ε-closure(q) is every state reachable from q using only ε-moves, including q itself. It is the first step of every move in an ε-NFA.',
  },
  {
    title: 'Subset construction',
    body: 'Each DFA state is a set of ε-NFA states. Start from ε-closure(q₀); for each set S and symbol a, the next set is ε-closure(move(S, a)). A set is final if it contains a final ε-NFA state. The empty set ∅ becomes the dead state.',
  },
  {
    title: 'Minimization',
    body: 'Partition refinement splits the DFA’s states into groups that no input string can tell apart, then merges each group into one state, giving the smallest equivalent DFA.',
  },
]

/** What the project is and the theory behind it. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="About">
      <p className="mb-3 text-sm leading-relaxed text-slate-600">
        ε-NFA → DFA Studio is a CSET302 Automata Theory project. It converts an ε-NFA to an equivalent DFA step by step,
        tests strings on both machines, and minimizes the result.
      </p>
      <div className="flex flex-col gap-2.5">
        {TOPICS.map((t) => (
          <section key={t.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{t.title}</h3>
            <p className="text-sm leading-relaxed text-slate-600">{t.body}</p>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
