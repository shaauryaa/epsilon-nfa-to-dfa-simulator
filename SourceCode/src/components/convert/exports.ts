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
  stepLogText,
} from '../../core'
import { saveBlob, saveText, svgToPng } from '../../lib/download'
import { automatonSVG, type Diagram } from '../../model/svg'
import { getPreset } from '../../presets'
import { useApp } from '../../store/automaton'
import { getConversion, useConvert } from '../../store/convert'
import { toast } from '../../store/toasts'
import { dfaCaption, layoutDFA } from '../../model/dfaLayout'

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

/** The ε-NFA diagram as on the canvas. */
export function nfaDiagram(): Diagram {
  const { nfa, positions } = useApp.getState()
  return automatonSVG({ machine: nfa, positions, title: `ε-NFA — ${machineName().title}` })
}

/** The converted DFA's diagram, with subsets under each state. */
export function dfaDiagram(): Diagram | null {
  const conv = current()
  if (!conv) return null
  const dfa = conv.result.dfa
  return automatonSVG({
    machine: dfaToENFA(dfa),
    positions: layoutDFA(dfa),
    captions: Object.fromEntries(dfa.states.map((s) => [s, dfaCaption(dfa, s)])),
    dead: dfa.deadState,
    title: `DFA — ${machineName().title}`,
  })
}

async function saveDiagram(d: Diagram, name: string, kind: 'png' | 'svg') {
  if (kind === 'svg') saveText(name, d.svg, 'image/svg+xml')
  else saveBlob(name, await svgToPng(d.svg, d.width, d.height))
}

async function run(label: string, fn: () => Promise<string | null> | string | null) {
  try {
    const name = await fn()
    if (name) toast({ message: `Downloaded ${name}`, tone: 'success' })
  } catch (e) {
    toast({ message: `Could not create the ${label}: ${(e as Error).message}`, tone: 'error' })
  }
}

/**
 * Downloads the converted DFA in one format.
 *
 * @param format - See {@link DFA_FORMATS}.
 */
export function downloadDfa(format: DfaFormat): Promise<void> {
  return run('download', async () => {
    const conv = current()
    if (!conv) return null
    const dfa = conv.result.dfa
    const { slug, title } = machineName()
    const name = exportFileName(slug, 'dfa', format, new Date())
    switch (format) {
      case 'jff':
        saveText(name, dfaToJFLAP(dfa, layoutDFA(dfa)), 'application/xml')
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
      case 'svg':
        await saveDiagram(dfaDiagram()!, name, format)
        break
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
    const dfaImg = dfaDiagram()
    if (!conv || !closures || !dfaImg) return null
    toast({ message: 'Preparing the report…', tone: 'info' })
    const { buildReport } = await import('../../lib/report')
    const { slug, title } = machineName()
    const when = new Date()
    const blob = await buildReport({ name: title, nfa, closures, result: conv.result, nfaDiagram: nfaDiagram(), dfaDiagram: dfaImg, when })
    const name = exportFileName(slug, 'report', 'pdf', when)
    saveBlob(name, blob)
    return name
  })
}
