import { useEffect, type ReactNode } from 'react'
import { useDocs, type DocTopic } from '../store/docs'
import { Dialog } from './ui/Dialog'

const kbd = 'rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700'
const eps = 'font-mono text-violet-700'
const m = 'font-mono text-slate-900'

/** A formula or worked line in mono type. */
function F({ children }: { children: ReactNode }) {
  return <p className="my-1.5 overflow-x-auto rounded-md bg-white px-2.5 py-1.5 font-mono text-xs leading-relaxed whitespace-pre text-slate-800 ring-1 ring-slate-200">{children}</p>
}

/** The (a|b)*abb example inside a card. */
function Example({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 border-l-2 border-blue-300 pl-3 text-xs leading-relaxed text-slate-600">
      <p className="mb-0.5 text-[11px] font-semibold tracking-wide text-blue-800 uppercase">Example: (a|b)*abb</p>
      {children}
    </div>
  )
}

const CARDS: { id: DocTopic; title: string; body: ReactNode }[] = [
  {
    id: 'enfa',
    title: 'ε-NFA',
    body: (
      <>
        <p>
          A nondeterministic finite automaton with ε-moves is a 5-tuple <span className={m}>M = (Q, Σ, δ, q₀, F)</span>. From a state it may move on a symbol to
          several states, or move on <span className={eps}>ε</span> without reading input. It accepts a string if <em>some</em> path ends in a final state.
        </p>
        <F>{'δ : Q × (Σ ∪ {ε}) → 𝒫(Q)'}</F>
        <Example>Thompson’s construction gives 11 states 0–10, Σ = {'{a, b}'}, q₀ = 0, F = {'{10}'}.</Example>
      </>
    ),
  },
  {
    id: 'closure',
    title: 'ε-closure',
    body: (
      <>
        <p>Every state reachable using only ε-moves, including the state itself. For a set, take the union. Computed by depth-first search: each state and each ε-edge is visited once, O(|Q| + |δ_ε|).</p>
        <F>{'ε-closure(T) = T ∪ { p | q →ε…ε→ p, q ∈ T }'}</F>
        <Example>ε-closure(0) = {'{0,1,2,4,7}'}. This is DFA state A.</Example>
      </>
    ),
  },
  {
    id: 'move',
    title: 'move(T, a)',
    body: (
      <>
        <p>The states reached from a set T by one transition on symbol a, before any ε-moves. The next DFA state is the ε-closure of that set.</p>
        <F>{'move(T, a) = ⋃ δ(q, a) for q ∈ T'}</F>
        <Example>
          move(A, a) = {'{3,8}'}, and ε-closure({'{3,8}'}) = {'{1,2,3,4,6,7,8}'} = B.
        </Example>
      </>
    ),
  },
  {
    id: 'subset',
    title: 'Subset construction',
    body: (
      <>
        <p>Each DFA state is a set of ε-NFA states. Start from the ε-closure of q₀ and add sets as they are found. A set is final if it holds a final ε-NFA state.</p>
        <F>{'start  = ε-closure({q₀})\nDtran[T, a] = ε-closure(move(T, a))\nT ∈ F_D  ⇔  T ∩ F ≠ ∅'}</F>
        <Example>
          <table className="mt-1 border-collapse font-mono text-[11px]">
            <tbody>
              {[
                ['→A', '{0,1,2,4,7}', 'B', 'C'],
                ['B', '{1,2,3,4,6,7,8}', 'B', 'D'],
                ['C', '{1,2,4,5,6,7}', 'B', 'C'],
                ['D', '{1,2,4,5,6,7,9}', 'B', 'E'],
                ['*E', '{1,2,4,5,6,7,10}', 'B', 'C'],
              ].map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className="pr-3 text-slate-800">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1">Columns: DFA state, NFA states, on a, on b.</p>
        </Example>
      </>
    ),
  },
  {
    id: 'dead',
    title: 'Dead state ∅',
    body: (
      <>
        <p>
          When move(T, a) is empty, the DFA moves to the empty set ∅. It is non-final and loops to itself on every symbol, so once there no string is accepted. With ∅ the
          DFA is complete (δ is a total function). Without it the DFA is partial and a missing move means reject. Both accept the same language. Minimization needs a complete
          DFA, so it adds ∅ when moves are missing.
        </p>
        <Example>Every set has a move on a and on b, so this DFA needs no dead state.</Example>
      </>
    ),
  },
  {
    id: 'minimise',
    title: 'Minimization (partition refinement)',
    body: (
      <>
        <p>
          Remove unreachable states, complete the DFA, then start from two blocks, final and non-final. In each round a block splits when its members move to different blocks
          on some symbol. When a round splits nothing, each block is one state of the minimal DFA. That DFA is unique up to renaming (Myhill–Nerode). This is Moore’s
          algorithm, O(n² · |Σ|); Hopcroft’s version runs in O(n log n · |Σ|).
        </p>
        <F>{'P₀ = { F, Q − F }\np ≡ₖ₊₁ q  ⇔  p ≡ₖ q  and  δ(p, a) ≡ₖ δ(q, a) for all a'}</F>
        <Example>
          Round 0: {'{E}'} | {'{A,B,C,D}'}. Round 1: D splits off on b (D → E, a final state). Round 2: B splits off on b (B → D). Round 3: stable, so {'{A,C}'}, B, D, E
          gives 4 states.
        </Example>
      </>
    ),
  },
  {
    id: 'complexity',
    title: 'Complexity and the 2ⁿ blow-up',
    body: (
      <>
        <p>
          An n-state ε-NFA can need up to 2ⁿ DFA states, one per subset. The worst case is “the k-th symbol from the end is a”: k + 1 NFA states, but the DFA must remember
          the last k symbols, so it needs 2ᵏ states, and none of them merge. Subset construction runs in O(2ⁿ · |Σ| · n²) in the worst case. In practice only the reachable
          subsets are built.
        </p>
        <Example>The Thompson ε-NFA has 11 states, so the bound is 2¹¹ = 2048, but only 5 subsets are reachable.</Example>
        <p className="mt-2 text-xs text-slate-600">DFAs with more than 60 states are shown as tables only, without the diagram or the animation.</p>
      </>
    ),
  },
]

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Define',
    body: (
      <>
        Build the ε-NFA in the builder: add states, pick the start state, toggle final states and add transitions (ε as <span className={eps}>ε</span> or{' '}
        <span className={eps}>eps</span>). Or load a preset, or import a <span className="font-mono">.json</span>, <span className="font-mono">.jff</span> or{' '}
        <span className="font-mono">.txt</span> file. Errors (red) must be fixed before converting; warnings (amber) are allowed.
      </>
    ),
  },
  {
    title: 'Convert',
    body: <>Play the subset construction step by step. The ε-NFA shows the set S, move(S, a) and the ε-closure; the DFA and its table fill in as states are found.</>,
  },
  {
    title: 'Test',
    body: <>Type a string (leave it empty for ε) to run it on both machines symbol by symbol. The batch tester compares the expected verdicts with the ε-NFA, the DFA and the minimal DFA.</>,
  },
  {
    title: 'Minimize',
    body: <>Watch partition refinement round by round. Each block has its own colour. The text names the symbol and the moves that split each block, and the last step shows the minimal DFA next to the original.</>,
  },
  {
    title: 'Read and download',
    body: (
      <>
        Use <strong>Show</strong> above the canvas to give one machine the whole canvas. <strong>Fit</strong> shows the whole graph. Download the DFA or the minimal DFA as
        .jff, JSON, text, .dot, CSV, PNG, SVG, Python or JavaScript, or the full PDF report from the top bar.
      </>
    ),
  },
]

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Space'], action: 'Play or pause (Convert, Test, Minimize)' },
  { keys: ['←', '→'], action: 'Step back or forward' },
  { keys: ['Ctrl', 'Z'], action: 'Undo a machine edit' },
  { keys: ['Ctrl', 'Y'], action: 'Redo (also Ctrl + Shift + Z)' },
  { keys: ['←', '→'], action: 'Switch modes when the mode tabs have focus' },
  { keys: ['Esc'], action: 'Close a dialog or menu' },
]

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`doc-${id}`} aria-labelledby={`doc-${id}-title`} className="scroll-mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 id={`doc-${id}-title`} className="mb-1.5 text-sm font-semibold text-slate-900">
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-pretty text-slate-600">{children}</div>
    </section>
  )
}

/** Theory cards with the (a|b)*abb example, how to use the app, the text format and keyboard shortcuts. */
export function DocsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const topic = useDocs((s) => s.topic)
  useEffect(() => {
    if (!open || !topic) return
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(`doc-${topic}`)
      if (!el) return
      el.scrollIntoView({ block: 'start' })
      el.classList.remove('focus-flash')
      void el.offsetWidth
      el.classList.add('focus-flash')
    })
    return () => cancelAnimationFrame(id)
  }, [open, topic])

  return (
    <Dialog open={open} onClose={onClose} title="Documentation">
      <nav aria-label="Contents" className="mb-4 flex flex-wrap gap-1.5">
        {[...CARDS.map((c) => ({ id: c.id, title: c.title })), { id: 'howto', title: 'How to use' }, { id: 'shortcuts', title: 'Shortcuts' }].map((c) => (
          <a
            key={c.id}
            href={`#doc-${c.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(`doc-${c.id}`)?.scrollIntoView({ block: 'start' })
            }}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            {c.title}
          </a>
        ))}
      </nav>
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Theory</h3>
      <div className="flex flex-col gap-2.5">
        {CARDS.map((c) => (
          <Card key={c.id} id={c.id} title={c.title}>
            {c.body}
          </Card>
        ))}
      </div>

      <h3 id="doc-howto" className="mt-6 mb-2 scroll-mt-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        How to use
      </h3>
      <ol className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">{i + 1}</span>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">{s.title}</h4>
              <p className="mt-0.5 text-xs leading-relaxed text-pretty text-slate-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="mt-3">
        <h4 className="mb-1.5 text-sm font-semibold text-slate-900">Text format</h4>
        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800">
          {`states: q0 q1 q2
alphabet: a b
start: q0
final: q2
q0 a -> q0 q1     # several targets
q1 eps -> q2      # ε-move (eps, epsilon or ε)`}
        </pre>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          In the text format <span className={eps}>e</span> also means ε unless <span className="font-mono">e</span> is in the alphabet. In the Add transition form only{' '}
          <span className={eps}>ε</span> and <span className={eps}>eps</span> mean ε.
        </p>
      </section>

      <h3 id="doc-shortcuts" className="mt-6 mb-2 scroll-mt-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Keyboard shortcuts
      </h3>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {SHORTCUTS.map((s, i) => (
            <tr key={i} className="border-t border-slate-100 first:border-t-0">
              <td className="py-1.5 pr-4 whitespace-nowrap">
                {s.keys.map((k, j) => (
                  <span key={j}>
                    {j > 0 && <span className="mx-1 text-slate-400">{s.keys[0] === 'Ctrl' ? '+' : '/'}</span>}
                    <kbd className={kbd}>{k}</kbd>
                  </span>
                ))}
              </td>
              <td className="py-1.5 text-slate-600">{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">Double-click the Define canvas to add a state. Your machine is kept in this browser between visits.</p>
    </Dialog>
  )
}

const LIBRARIES: { name: string; use: string }[] = [
  { name: 'React 19 and React DOM', use: 'user interface' },
  { name: 'TypeScript', use: 'typed source' },
  { name: 'Vite', use: 'dev server and build' },
  { name: 'Tailwind CSS 4', use: 'styling' },
  { name: 'React Flow', use: 'graph canvas' },
  { name: 'dagre', use: 'graph layout' },
  { name: 'Zustand', use: 'state' },
  { name: 'jsPDF and jspdf-autotable', use: 'PDF report' },
  { name: 'DejaVu Sans', use: 'ε and ∅ in the PDF' },
  { name: 'Inter and JetBrains Mono (Fontsource)', use: 'fonts' },
  { name: 'Vitest, jsdom and oxlint', use: 'tests and lint' },
]

/** Project title, course, team, guide and the libraries used. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="About">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">ε-NFA to DFA Simulator</h3>
      <p className="mt-1 text-sm text-slate-600">CSET302 Automata Theory and Computability · Bennett University</p>
      <p className="mt-3 text-sm leading-relaxed text-pretty text-slate-600">
        Converts an ε-NFA to an equivalent DFA step by step, tests strings on both machines and minimizes the result by partition refinement.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <dt className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Team</dt>
          <dd className="mt-1 space-y-0.5 text-sm text-slate-900">
            <p>
              Shaurya Nigam <span className="font-mono text-xs text-slate-500">S24CSEU0497</span>
            </p>
            <p>
              Vishnu Verma <span className="font-mono text-xs text-slate-500">S24CSEU2382</span>
            </p>
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <dt className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Guided by</dt>
          <dd className="mt-1 text-sm text-slate-900">Dr. Sunil Kumar</dd>
        </div>
      </dl>
      <h4 className="mt-5 mb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Libraries used</h4>
      <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {LIBRARIES.map((l) => (
          <li key={l.name} className="text-slate-800">
            {l.name} <span className="text-xs text-slate-500">· {l.use}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">MIT License.</p>
    </Dialog>
  )
}
