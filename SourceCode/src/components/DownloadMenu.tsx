import { useState, type ReactNode } from 'react'
import { useApp } from '../store/automaton'
import { downloadDfa, downloadNfaImage, downloadReport, downloadStepLog } from './convert/exports'
import { downloadBatchCSV, downloadRunCSV } from './test/testExports'
import { ChevronIcon, DownloadIcon, FileIcon, ImageIcon, TableIcon, TextIcon } from './ui/Icons'
import { Popover } from './ui/Popover'

interface Item {
  label: string
  hint: string
  icon: ReactNode
  run: () => Promise<void>
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Report',
    items: [
      {
        label: 'Download full report (PDF)',
        hint: 'ε-NFA, ε-closures, every step, the DFA, the mapping, minimisation and the string tests.',
        icon: <FileIcon size={15} />,
        run: downloadReport,
      },
    ],
  },
  {
    title: 'Diagrams',
    items: [
      { label: 'ε-NFA as PNG', hint: 'High-resolution image', icon: <ImageIcon size={15} />, run: () => downloadNfaImage('png') },
      { label: 'ε-NFA as SVG', hint: 'Scalable vector image', icon: <ImageIcon size={15} />, run: () => downloadNfaImage('svg') },
      { label: 'DFA as PNG', hint: 'High-resolution image', icon: <ImageIcon size={15} />, run: () => downloadDfa('png') },
      { label: 'DFA as SVG', hint: 'Scalable vector image', icon: <ImageIcon size={15} />, run: () => downloadDfa('svg') },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'DFA table (CSV)', hint: 'Opens in Excel or Google Sheets', icon: <TableIcon size={15} />, run: () => downloadDfa('csv') },
      { label: 'DFA (JSON)', hint: 'Re-import with Import', icon: <FileIcon size={15} />, run: () => downloadDfa('json') },
      { label: 'Step log (TXT)', hint: 'Every subset construction step', icon: <TextIcon size={15} />, run: downloadStepLog },
    ],
  },
  {
    title: 'Tests',
    items: [
      { label: 'String test result (CSV)', hint: 'Both verdicts and every step for the Test tab’s input', icon: <TableIcon size={15} />, run: downloadRunCSV },
      { label: 'Batch test results (CSV)', hint: 'Expected and generated result for each string', icon: <TableIcon size={15} />, run: downloadBatchCSV },
    ],
  },
]

/**
 * Navbar "Download" menu: diagrams, the DFA, the step log and the full PDF
 * report. Disabled until the machine can be converted.
 */
export function DownloadMenu() {
  const ready = useApp((s) => s.subset !== null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)
  return (
    <>
      <button
        type="button"
        disabled={!ready}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        title={ready ? 'Download diagrams, tables and the full report' : 'Fix the machine’s errors to download a conversion'}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="press flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <DownloadIcon size={15} />
        <span>Download</span>
        <ChevronIcon size={13} className={`text-slate-400 transition-transform duration-150 ${anchor ? 'rotate-180' : ''}`} />
      </button>
      <Popover open={!!anchor} anchor={anchor} onClose={close} label="Download" width={290}>
        <div role="menu" aria-label="Download" className="-m-1 flex max-h-[70vh] flex-col overflow-y-auto">
          {GROUPS.map((g, gi) => (
            <div key={g.title} role="group" aria-label={g.title} className={gi > 0 ? 'mt-1 border-t border-slate-100 pt-1' : ''}>
              <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.title}</p>
              {g.items.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  autoFocus={gi === 0 && i === 0}
                  onClick={() => {
                    close()
                    void item.run()
                  }}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
                >
                  <span className="mt-0.5 text-slate-400">{item.icon}</span>
                  <span className="min-w-0">
                    <span className={`block text-sm text-slate-900 ${gi === 0 ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Popover>
    </>
  )
}
