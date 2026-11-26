import { useEffect, useRef } from 'react'
import { useApp } from '../../store/automaton'
import { AlertIcon, CheckIcon } from '../ui/Icons'

const LINE = 22 // px, must match the textarea's line-height

/** Last focus request handled, so remounting does not replay an old one. */
let handledFocus = 0

/** Selects a 1-based line in a textarea and scrolls it into view. */
function selectLine(el: HTMLTextAreaElement, line: number) {
  const lines = el.value.split('\n')
  const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0)
  el.focus({ preventScroll: true })
  el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0))
  el.scrollTop = Math.max(0, (line - 3) * LINE)
  el.scrollIntoView({ block: 'nearest' })
}

/**
 * Plain-text editor for the machine, parsed live with `parseText`. A parse
 * error keeps the last good machine and marks the failing line.
 */
export function TextEditor() {
  const text = useApp((s) => s.textDraft)
  const parseError = useApp((s) => s.parseError)
  const setText = useApp((s) => s.setTextDraft)
  const focusRequest = useApp((s) => s.focusRequest)
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const lineCount = text.split('\n').length

  useEffect(() => {
    if (!focusRequest || focusRequest.target.kind !== 'text' || focusRequest.nonce === handledFocus) return
    handledFocus = focusRequest.nonce
    if (area.current) selectLine(area.current, focusRequest.target.line)
  }, [focusRequest])

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex min-h-0 flex-1 font-mono text-[13px]">
        <div
          ref={gutter}
          aria-hidden="true"
          className="w-11 shrink-0 overflow-hidden border-r border-slate-100 bg-slate-50/70 py-3 pr-2 text-right text-slate-400 select-none"
          style={{ lineHeight: `${LINE}px` }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className={parseError?.line === i + 1 ? 'rounded-l bg-red-100 font-semibold text-red-600' : undefined}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop
          }}
          aria-label="Machine definition as text"
          aria-invalid={!!parseError}
          aria-describedby="text-status"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          className="min-w-0 flex-1 resize-none overflow-auto bg-white px-3 py-3 whitespace-pre text-slate-800 outline-none"
          style={{ lineHeight: `${LINE}px` }}
        />
      </div>
      <div
        id="text-status"
        aria-live="polite"
        className={`flex items-start gap-2 border-t px-4 py-2.5 text-xs ${
          parseError ? 'border-red-100 bg-red-50 text-red-700' : 'border-slate-100 text-slate-500'
        }`}
      >
        {parseError ? (
          <>
            <AlertIcon size={14} className="mt-px shrink-0" />
            <span>
              <button
                type="button"
                className="font-semibold underline decoration-red-300 underline-offset-2 hover:decoration-red-600"
                onClick={() => area.current && selectLine(area.current, parseError.line)}
              >
                Line {parseError.line}
              </button>
              : {parseError.message}. The table and graph show the last machine that parsed.
            </span>
          </>
        ) : (
          <>
            <CheckIcon size={14} className="mt-px shrink-0 text-emerald-600" />
            <span>
              Parsed. Format: <code className="text-slate-700">states:</code>, <code className="text-slate-700">alphabet:</code>,{' '}
              <code className="text-slate-700">start:</code>, <code className="text-slate-700">final:</code>, then lines like{' '}
              <code className="text-slate-700">q0 a -&gt; q1 q2</code>; write ε as <code className="text-slate-700">eps</code>.
            </span>
          </>
        )}
      </div>
    </div>
  )
}
