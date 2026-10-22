// Text measurement from the vendored Geist advance widths, plus the <text>
// helper every component uses. Kerning is ignored, so widths are within ~1–2%.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveFont } from './fonts.mjs'
import { esc, h } from './svg.mjs'
import { color as palette } from './tokens.mjs'

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor')
const metrics = JSON.parse(fs.readFileSync(path.join(vendor, 'metrics.json'), 'utf8'))

// Width in px. `tracking` is in em, applied after every glyph like CSS letter-spacing.
export function measure(text, { family = 'sans', weight = 400, size = 14, tracking = 0 } = {}) {
  const m = metrics[resolveFont(family, weight)]
  let units = 0
  for (const ch of String(text)) units += m.widths[ch] ?? m.fallback
  const chars = [...String(text)].length
  return (units / m.unitsPerEm) * size + tracking * size * chars
}

// Cap height in px — handy for vertically centring text in a box.
export function capHeight({ family = 'sans', weight = 400, size = 14 } = {}) {
  const m = metrics[resolveFont(family, weight)]
  return (m.capHeight / m.unitsPerEm) * size
}

// Baseline y that vertically centres a single line of caps/x-height text at `cy`.
export function centerBaseline(cy, opts) {
  return cy + capHeight(opts) / 2
}

export function truncate(text, maxWidth, opts) {
  if (measure(text, opts) <= maxWidth) return text
  let out = String(text)
  while (out.length > 1 && measure(`${out}…`, opts) > maxWidth) out = out.slice(0, -1)
  return `${out.trimEnd()}…`
}

// Greedy word wrap.
export function wrap(text, maxWidth, opts) {
  const lines = []
  let line = ''
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next, opts) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * <text> element with a font class. Options:
 *   size, weight, family ('sans'|'mono'), fill, anchor ('start'|'middle'|'end'),
 *   tracking (em), opacity, cls (extra classes), attrs (extra attributes),
 *   content (raw markup instead of escaped text — e.g. <tspan>s)
 */
export function txt(x, y, text, opts = {}) {
  const {
    size = 14,
    weight = 400,
    family = 'sans',
    fill = palette.text,
    anchor,
    tracking = 0,
    opacity,
    cls,
    attrs: extra = {},
    content,
  } = opts
  const key = resolveFont(family, weight)
  return h(
    'text',
    {
      x,
      y,
      class: cls ? `f-${key} ${cls}` : `f-${key}`,
      'font-size': size,
      fill,
      'text-anchor': anchor,
      'letter-spacing': tracking ? `${tracking}em` : null,
      opacity,
      ...extra,
    },
    content ?? esc(text),
  )
}
