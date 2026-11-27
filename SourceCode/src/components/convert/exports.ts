import {
  dfaToCSV,
  dfaToDot,
  dfaToENFA,
  dfaToJavaScript,
  dfaToJFLAP,
  dfaToJSON,
  dfaToPython,
  dfaToText,
  exportFileName,
  minimizeDFA,
  stepLogText,
  type DFA,
} from '../../core'
import { saveBlob, saveText, svgToPng } from '../../lib/download'
import { automatonSVG, type Diagram } from '../../model/svg'
import { getPreset } from '../../presets'
import { useApp } from '../../store/automaton'
import { getConversion, useConvert } from '../../store/convert'
import { toast } from '../../store/toasts'
import { dfaCaptions, layoutDFA } from '../../model/dfaLayout'
import { MAX_DRAWN_DFA_STATES } from '../../model/largeDfa'
import { reportTests } from '../test/testExports'
import { getMinimization } from '../../store/minimize'
import { minStateLabel } from '../../model/minimizeView'

/** DFA download formats offered on the result card. */
export type DfaFormat = 'jff' | 'json' | 'txt' | 'dot' | 'csv' | 'png' | 'svg' | 'py' | 'js'

/** Each DFA format with its menu label and one-line description. */
export const DFA_FORMATS: { id: DfaFormat; label: string; description: string }[] = [
  { id: 'jff', label: 'JFLAP file (.jff)', description: 'Opens directly in JFLAP with states, start, finals, transitions and layout.' },
  { id: 'json', label: 'JSON (.json)', description: 'This app’s format; load it again with Import.' },
  { id: 'txt', label: 'Text (.txt)', description: 'The Define tab’s text format, ready to paste back in.' },
  { id: 'dot', label: 'Graphviz (.dot)', description: 'Render with dot -Tpng or any Graphviz viewer.' },
  { id: 'csv', label: 'Transition table (.csv)', description: 'Opens in Excel or Google Sheets.' },
  { id: 'png', label: 'Image (.png)', description: 'The DFA diagram as a high-resolution picture.' },
  { id: 'svg', label: 'Image (.svg)', description: 'The DFA diagram as a scalable vector image.' },
  { id: 'py', label: 'Python (.py)', description: 'A ready-to-run accepts(string) function with examples.' },
  { id: 'js', label: 'JavaScript (.js)', description: 'A ready-to-run accepts(string) function with examples.' },
]

/** The current machine's name for file names and headings. */
export function machineName(): { slug: string; title: string } {
  const id = useApp.getState().presetId
  const preset = id ? getPreset(id) : undefined
  return preset ? { slug: preset.id, title: preset.name } : { slug: 'machine', title: 'Custom ε-NFA' }
}

function current() {
  const { nfa, subset } = useApp.getState()
  return getConversion(nfa, subset, useConvert.getState().showDead)
}

/** Which DFA a download is for: the converted DFA or its minimal DFA. */
export type DfaSource = 'dfa' | 'min'

/** The minimal DFA of the converted DFA, as the Minimize tab shows it. */
function currentMin() {
  const conv = current()
  return conv ? getMinimization(conv.result.dfa).view : null
}

/** Captions of a minimal DFA: the merged name where it does not fit in the circle. */
function minCaptions(dfa: DFA): Record<string, string> {
  const captions: Record<string, string> = {}
  for (const s of dfa.states) {
    const c = minStateLabel(s).caption
    if (c) captions[s] = c
  }
  return captions
}

/** The minimal DFA's diagram: plain states, long merged names as captions. */
export function minDiagram(): Diagram | null {
  const view = currentMin()
  if (!view || view.large) return null
  const dfa = view.result.dfa
  const captions = minCaptions(dfa)
  return automatonSVG({
    machine: dfaToENFA(dfa),
    positions: layoutDFA(dfa, captions),
    captions,
    dead: dfa.deadState,
    title: `Minimal DFA — ${machineName().title}`,
  })
}

/** The ε-NFA diagram as on the canvas. */
export function nfaDiagram(): Diagram {
  const { nfa, positions } = useApp.getState()
  return automatonSVG({ machine: nfa, positions, title: `ε-NFA — ${machineName().title}` })
}

/** The converted DFA's diagram, with subsets under each state. */
export function dfaDiagram(): Diagram | null {
  const conv = current()
  if (!conv || conv.large) return null
  const dfa = conv.result.dfa
  return automatonSVG({
    machine: dfaToENFA(dfa),
    positions: layoutDFA(dfa),
    captions: dfaCaptions(dfa),
    dead: dfa.deadState,
    title: `DFA — ${machineName().title}`,
  })
}

async function saveDiagram(d: Diagram, name: string, kind: 'png' | 'svg') {
  if (kind === 'svg') saveText(name, d.svg, 'image/svg+xml')
  else saveBlob(name, await svgToPng(d.svg, d.width, d.height))
}

export async function run(label: string, fn: () => Promise<string | null> | string | null) {
  try {
    const name = await fn()
    if (name) toast({ message: `Downloaded ${name}`, tone: 'success' })
  } catch (e) {
    toast({ message: `Could not create the ${label}: ${(e as Error).message}`, tone: 'error' })
  }
}

/**
 * Downloads the converted DFA, or its minimal DFA, in one format.
 *
 * @param format - See {@link DFA_FORMATS}.
 * @param which - `dfa` (default) for the converted DFA, `min` for the minimal DFA.
 */
export function downloadDfa(format: DfaFormat, which: DfaSource = 'dfa'): Promise<void> {
  return run('download', async () => {
    const conv = current()
    if (!conv) return null
    const minView = which === 'min' ? currentMin() : null
    const dfa = minView ? minView.result.dfa : conv.result.dfa
    const { slug, title: baseTitle } = machineName()
    const title = minView ? `${baseTitle} (minimal)` : baseTitle
    const name = exportFileName(slug, minView ? 'min-dfa' : 'dfa', format, new Date())
    switch (format) {
      case 'jff':
        saveText(name, dfaToJFLAP(dfa, minView ? layoutDFA(dfa, minCaptions(dfa)) : layoutDFA(dfa)), 'application/xml')
        break
      case 'json':
        saveText(name, dfaToJSON(dfa), 'application/json')
        break
      case 'txt':
        saveText(name, dfaToText(dfa))
        break
      case 'dot':
        saveText(name, dfaToDot(dfa, title), 'text/vnd.graphviz')
        break
      case 'csv':
        saveText(name, dfaToCSV(dfa), 'text/csv')
        break
      case 'py':
        saveText(name, dfaToPython(dfa, title), 'text/x-python')
        break
      case 'js':
        saveText(name, dfaToJavaScript(dfa, title), 'text/javascript')
        break
      case 'png':
      case 'svg': {
        const d = minView ? minDiagram() : dfaDiagram()
        if (!d) throw new Error(`the DFA has ${dfa.states.length} states, more than the ${MAX_DRAWN_DFA_STATES} that can be drawn. Use CSV or JSON instead.`)
        await saveDiagram(d, name, format)
        break
      }
    }
    return name
  })
}

/** Downloads the ε-NFA diagram as PNG or SVG. */
export function downloadNfaImage(kind: 'png' | 'svg'): Promise<void> {
  return run('image', async () => {
    const name = exportFileName(machineName().slug, 'enfa', kind, new Date())
    await saveDiagram(nfaDiagram(), name, kind)
    return name
  })
}

/** Downloads the subset construction step log as plain text. */
export function downloadStepLog(): Promise<void> {
  return run('step log', () => {
    const conv = current()
    if (!conv) return null
    const { slug, title } = machineName()
    const name = exportFileName(slug, 'steps', 'txt', new Date())
    saveText(name, stepLogText(useApp.getState().nfa, conv.result, title))
    return name
  })
}

/** Builds and downloads the full PDF report. */
export function downloadReport(): Promise<void> {
  return run('report', async () => {
    const conv = current()
    const { nfa, closures } = useApp.getState()
    if (!conv || !closures) return null
    toast({ message: 'Preparing the report…', tone: 'info' })
    const { buildReport } = await import('../../lib/report')
    const { slug, title } = machineName()
    const when = new Date()
    const blob = await buildReport({
      name: title,
      nfa,
      closures,
      result: conv.result,
      minimized: minimizeDFA(conv.result.dfa),
      showDead: useConvert.getState().showDead,
      nfaDiagram: nfaDiagram(),
      dfaDiagram: dfaDiagram(),
      when,
      tests: reportTests(),
    })
    const name = exportFileName(slug, 'report', 'pdf', when)
    saveBlob(name, blob)
    return name
  })
}
