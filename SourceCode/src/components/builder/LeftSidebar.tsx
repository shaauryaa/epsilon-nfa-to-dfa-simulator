import { useEffect, useRef } from 'react'
import { focusKey } from '../../model/issues'
import { useApp } from '../../store/automaton'
import { TextIcon } from '../ui/Icons'
import { AlphabetSection } from './AlphabetSection'
import { Section } from './Section'
import { StatesSection } from './StatesSection'
import { TextEditor } from './TextEditor'
import { TransitionsSection } from './TransitionsSection'
import { TransitionTable } from './TransitionTable'
import { ValidationBanner } from './ValidationBanner'

/** Last focus request handled, so remounting does not replay an old one. */
let handledFocus = 0

function TextSection() {
  const open = useApp((s) => s.editorView === 'text')
  const setView = useApp((s) => s.setEditorView)
  return (
    <Section title="Text format" icon={<TextIcon size={13} />} collapsible={{ open, onToggle: () => setView(open ? 'table' : 'text') }}>
      <div className="h-80 overflow-hidden rounded-lg border border-slate-200">
        <TextEditor />
      </div>
    </Section>
  )
}

/**
 * The builder: validation banner, then States, Alphabet, Add transition,
 * Transition table and Text format. It scrolls on its own and moves focus
 * to whatever a validation problem points at.
 */
export function LeftSidebar() {
  const focusRequest = useApp((s) => s.focusRequest)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!focusRequest || focusRequest.target.kind === 'text' || focusRequest.nonce === handledFocus) return
    handledFocus = focusRequest.nonce
    const el =
      root.current?.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey(focusRequest.target))}"]`) ??
      root.current?.querySelector<HTMLElement>('[data-focus="add-state"]')
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    el.classList.remove('focus-flash')
    void el.offsetWidth
    el.classList.add('focus-flash')
  }, [focusRequest])

  return (
    <aside
      ref={root}
      aria-label="Builder"
      className="flex w-[var(--left-w)] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white"
    >
      <ValidationBanner />
      <StatesSection />
      <AlphabetSection />
      <TransitionsSection />
      <TransitionTable />
      <TextSection />
    </aside>
  )
}
