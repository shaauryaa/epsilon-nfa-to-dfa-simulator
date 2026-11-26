import { Dialog } from './ui/Dialog'

const kbd = 'rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700'

/** Short guide to the simulator and the Define tab. */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="How to use the simulator">
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-slate-700">
        <p>
          Define an ε-NFA, then follow it through ε-closure and subset construction to an equivalent DFA, test strings
          on both, and minimize the result. Start from an example in the header or build your own.
        </p>
        <section>
          <h3 className="mb-1.5 font-semibold text-slate-900">Define tab</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Table:</strong> one row per state and one column per symbol, plus ε. Type target states separated
              by commas, then press <kbd className={kbd}>Enter</kbd>. Click a state or symbol name to rename or delete
              it.
            </li>
            <li>
              <strong>Text:</strong> the same machine as text. It is parsed as you type; a mistake shows its line number
              and the other views keep the last version that parsed.
            </li>
            <li>
              <strong>Graph:</strong> drag states to move them. Drag from the blue dot on a state to another state (or
              the same one) and choose a symbol to add a transition. Dashed edges are ε-moves.
            </li>
            <li>All three views edit the same machine and stay in sync.</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1.5 font-semibold text-slate-900">Text format</h3>
          <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[13px] leading-5 text-slate-800">
            {`states: q0 q1 q2
alphabet: a b
start: q0
final: q2
q0 a -> q0 q1     # several targets
q1 eps -> q2      # ε-move (eps, epsilon or ε)`}
          </pre>
        </section>
        <section>
          <h3 className="mb-1.5 font-semibold text-slate-900">Validation</h3>
          <p>
            Errors (red) must be fixed before conversion; warnings (amber) are allowed. Click any problem to jump to
            it.
          </p>
        </section>
        <section>
          <h3 className="mb-1.5 font-semibold text-slate-900">Files and undo</h3>
          <p>
            Export saves the machine as JSON and Import loads it back. Your machine is kept in this browser between
            visits. Deleting, loading an example or starting a new machine shows an Undo button; you can also press{' '}
            <kbd className={kbd}>Ctrl</kbd> + <kbd className={kbd}>Z</kbd> outside a text field.
          </p>
        </section>
      </div>
    </Dialog>
  )
}
