/**
 * Draws an automaton as a standalone SVG document for downloads and the PDF
 * report. Uses the same layout positions, edge routing and colours as the
 * canvas, so the image matches what is on screen.
 */

import { EPSILON, type ENFA } from '../core'
import { NODE_SIZE, type XY } from '../graph/layout'
import { routeAll } from '../graph/routing'
import { CAPTION, captionRects } from './dfaLayout'
import { mergedEdges } from './graph'

/** Input for {@link automatonSVG}. */
export interface DiagramInput {
  machine: ENFA
  /** Top-left of each state, as used by the canvas. */
  positions: Record<string, XY>
  /** Optional text under a state (DFA subsets). */
  captions?: Record<string, string>
  /** A state to draw dashed (the DFA dead state). */
  dead?: string | null
  /** Heading drawn above the diagram. */
  title?: string
}

/** A rendered diagram. */
export interface Diagram {
  svg: string
  width: number
  height: number
}

const COLOR = { line: '#334155', eps: '#7c3aed', text: '#0f172a', muted: '#475569', fill: '#ffffff' }
const FONT = "'JetBrains Mono', 'DejaVu Sans Mono', Consolas, monospace"
const R = NODE_SIZE / 2
const PAD = 40

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** Rough monospace text width, enough to size label pills. */
const textWidth = (s: string, size: number) => [...s].length * size * 0.62

/**
 * Renders an automaton to SVG.
 *
 * States are circles (double for finals) with a start arrow; symbol edges
 * are solid slate, ε-edges dashed violet, each with a pill label. The view
 * box is fitted to the content plus padding.
 *
 * @param input - See {@link DiagramInput}.
 * @returns The SVG text and its pixel size.
 * @throws Never throws.
 */
export function automatonSVG(input: DiagramInput): Diagram {
  const { machine, positions, captions = {}, dead = null, title } = input
  const states = [...new Set(machine.states)].filter((s) => positions[s])
  const centres = new Map<string, XY>(states.map((s) => [s, { x: positions[s].x + R, y: positions[s].y + R }]))
  const edges = mergedEdges(machine).filter((e) => centres.has(e.source) && centres.has(e.target))
  // Captions are part of each state's box: edges and labels route around them, as on the canvas.
  const boxes = captionRects(positions, captions, states)
  const routes = routeAll(edges, centres, R, boxes)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const [s, c] of centres) {
    grow(c.x - R - (s === machine.start ? 50 : 0), c.y - R)
    grow(c.x + R, c.y + R)
  }
  for (const b of boxes) {
    grow(b.x, b.y)
    grow(b.x + b.width, b.y + b.height)
  }
  for (const e of edges) {
    const r = routes.get(e.id)
    if (!r) continue
    const w = textWidth(e.label, 13) / 2 + 10
    grow(r.labelX - w, r.labelY - 12)
    grow(r.labelX + w, r.labelY + 12)
    const nums = r.path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    for (let i = 0; i + 1 < nums.length; i += 2) grow(nums[i], nums[i + 1])
  }
  if (states.length === 0) {
    minX = 0
    minY = 0
    maxX = 200
    maxY = 80
  }
  const top = title ? 36 : 0
  const ox = PAD - minX
  const oy = PAD + top - minY
  const width = Math.ceil(maxX - minX + PAD * 2)
  const height = Math.ceil(maxY - minY + PAD * 2 + top)

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(FONT)}">`,
    '<defs>',
    `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COLOR.line}"/></marker>`,
    `<marker id="arrow-eps" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COLOR.eps}"/></marker>`,
    '</defs>',
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
  ]
  if (title) out.push(`<text x="${PAD}" y="${PAD - 4}" font-size="16" font-weight="700" fill="${COLOR.text}">${esc(title)}</text>`)
  out.push(`<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)})">`)

  for (const e of edges) {
    const r = routes.get(e.id)
    if (!r) continue
    const stroke = e.epsilonOnly ? COLOR.eps : COLOR.line
    out.push(
      `<path d="${r.path}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round"${e.epsilonOnly ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${e.epsilonOnly ? 'arrow-eps' : 'arrow'})"/>`,
    )
  }
  for (const e of edges) {
    const r = routes.get(e.id)
    if (!r) continue
    const w = textWidth(e.label, 13) + 16
    const border = e.epsilonOnly ? '#c4b5fd' : '#cbd5e1'
    out.push(
      `<rect x="${(r.labelX - w / 2).toFixed(1)}" y="${(r.labelY - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="10" fill="#fff" stroke="${border}"/>`,
      `<text x="${r.labelX}" y="${r.labelY}" font-size="13" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="${
        e.symbols.every((s) => s === EPSILON) ? COLOR.eps : COLOR.text
      }">${esc(e.label)}</text>`,
    )
  }
  const finals = new Set(machine.finals)
  for (const [s, c] of centres) {
    const isDead = s === dead
    const stroke = isDead ? '#94a3b8' : COLOR.text
    const dash = isDead ? ' stroke-dasharray="4 3"' : ''
    if (s === machine.start) {
      out.push(
        `<line x1="${c.x - R - 44}" y1="${c.y}" x2="${c.x - R - 9}" y2="${c.y}" stroke="${COLOR.text}" stroke-width="1.8"/>`,
        `<path d="M${c.x - R} ${c.y}L${c.x - R - 10} ${c.y - 4.5}L${c.x - R - 10} ${c.y + 4.5}z" fill="${COLOR.text}"/>`,
      )
    }
    out.push(`<circle cx="${c.x}" cy="${c.y}" r="${R}" fill="${isDead ? '#f8fafc' : COLOR.fill}" stroke="${stroke}" stroke-width="1.8"${dash}/>`)
    if (finals.has(s)) out.push(`<circle cx="${c.x}" cy="${c.y}" r="${R - 5}" fill="none" stroke="${stroke}" stroke-width="1.6"/>`)
    const size = s.length > 4 ? 10 : s.length > 2 ? 12 : 14
    out.push(
      `<text x="${c.x}" y="${c.y}" font-size="${size}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${isDead ? COLOR.muted : COLOR.text}">${esc(s)}</text>`,
    )
    if (captions[s]) {
      const b = captionRects(positions, captions, [s])[0]
      out.push(
        `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.width}" height="${b.height}" rx="4" fill="#ffffff"/>`,
        `<text x="${c.x}" y="${(b.y + b.height / 2).toFixed(1)}" font-size="${CAPTION.font - 1}" text-anchor="middle" dominant-baseline="central" fill="${COLOR.muted}">${esc(captions[s])}</text>`,
      )
    }
  }
  out.push('</g>', '</svg>')
  return { svg: out.join('\n'), width, height }
}
