/**
 * Reading a machine from a file: picks the right parser for JSON, JFLAP
 * (`.jff`) or the plain-text format, and turns parser errors into short,
 * friendly messages.
 */

import { FormatError, fromJSON, ParseError, parseText } from './automaton'
import { JFLAPError, parseJFLAP, type Point } from './export'
import type { ENFA } from './types'

/** The file formats {@link importMachine} understands. */
export type ImportFormat = 'json' | 'jff' | 'txt'

/** File extensions accepted by the Import button, for the file picker's `accept`. */
export const IMPORT_ACCEPT = '.json,.jff,.txt,application/json,text/plain,application/xml,text/xml'

/** Result of {@link importMachine}. */
export interface ImportedMachine {
  nfa: ENFA
  format: ImportFormat
  /** State positions from a JFLAP file (top-left corners), if it had any. */
  positions?: Record<string, Point>
}

/** Thrown by {@link importMachine}; `message` is ready to show to the user. */
export class ImportError extends Error {
  /** The format the file was read as, or `null` if it could not be recognised. */
  readonly format: ImportFormat | null
  constructor(message: string, format: ImportFormat | null) {
    super(message)
    this.name = 'ImportError'
    this.format = format
  }
}

/**
 * Decides which format a file is in. The extension wins when it is one of
 * `.json`, `.jff` or `.txt`; otherwise the content decides: `{` means JSON,
 * `<` means XML (JFLAP), anything else is the text format.
 *
 * @param fileName - The file's name (only the extension is used).
 * @param text - The file's contents.
 * @returns The format to parse it as.
 * @throws Never throws.
 */
export function detectFormat(fileName: string, text: string): ImportFormat {
  const ext = /\.([^.\\/]+)$/.exec(fileName.toLowerCase())?.[1]
  if (ext === 'json' || ext === 'jff' || ext === 'txt') return ext
  const head = text.replace(/^﻿/, '').trimStart()
  if (head.startsWith('{')) return 'json'
  if (head.startsWith('<')) return 'jff'
  return 'txt'
}

/**
 * Reads a machine from a file's name and contents.
 *
 * Routing: see {@link detectFormat}. If the extension says one thing and the
 * content clearly another (for example a `.json` file that starts with `<`),
 * the content wins, so a renamed file still loads. JSON goes to `fromJSON`,
 * JFLAP XML to `parseJFLAP` (state positions are returned, converted from
 * centres to top-left corners) and anything else to `parseText`.
 *
 * The machine is not validated here; the editor shows validation problems.
 *
 * @param fileName - The file's name, e.g. `abb.jff`.
 * @param text - The file's contents.
 * @param nodeSize - State circle diameter, to turn JFLAP centres into corners (default 56).
 * @returns The machine, the format it was read as and any positions.
 * @throws {ImportError} With a friendly message when the file is empty or
 *   cannot be parsed in the detected format.
 */
export function importMachine(fileName: string, text: string, nodeSize = 56): ImportedMachine {
  const body = text.replace(/^﻿/, '')
  if (body.trim() === '') throw new ImportError('The file is empty.', null)
  let format = detectFormat(fileName, body)
  const head = body.trimStart()[0]
  if (format === 'json' && head === '<') format = 'jff'
  else if (format === 'jff' && head === '{') format = 'json'
  else if (format === 'txt' && (head === '{' || head === '<')) format = head === '{' ? 'json' : 'jff'

  try {
    if (format === 'json') return { nfa: fromJSON(body), format }
    if (format === 'jff') {
      const { nfa, positions } = parseJFLAP(body)
      const corners: Record<string, Point> = {}
      for (const [s, p] of Object.entries(positions)) corners[s] = { x: p.x - nodeSize / 2, y: p.y - nodeSize / 2 }
      return { nfa, format, positions: Object.keys(corners).length > 0 ? corners : undefined }
    }
    return { nfa: parseText(body), format }
  } catch (e) {
    if (e instanceof FormatError) throw new ImportError(`This looks like a JSON file, but ${lowerFirst(e.message)}`, 'json')
    if (e instanceof JFLAPError) throw new ImportError(`This looks like a JFLAP file, but ${lowerFirst(e.message)}`, 'jff')
    if (e instanceof ParseError) throw new ImportError(`This looks like the text format, but ${lowerFirst(e.message)}`, 'txt')
    throw e
  }
}

function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s
}
