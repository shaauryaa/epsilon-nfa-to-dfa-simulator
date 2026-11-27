import { useDocs, type DocTopic } from '../store/docs'
import { BookIcon } from './ui/Icons'

const TITLES: Record<DocTopic, string> = {
  enfa: 'ε-NFA',
  closure: 'ε-closure',
  move: 'move(T, a)',
  subset: 'Subset construction',
  dead: 'Dead state',
  minimise: 'Minimization',
  complexity: 'Complexity and the 2ⁿ blow-up',
  howto: 'How to use',
  shortcuts: 'Keyboard shortcuts',
}

/** A small link under a tab's explanation that opens the matching theory card in Docs. */
export function TheoryLink({ topic, className = 'mt-2' }: { topic: DocTopic; className?: string }) {
  const showDocs = useDocs((s) => s.showDocs)
  return (
    <button
      type="button"
      onClick={() => showDocs(topic)}
      className={`${className} inline-flex items-center gap-1 rounded text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}
    >
      <BookIcon size={12} /> Theory: {TITLES[topic]}
    </button>
  )
}
