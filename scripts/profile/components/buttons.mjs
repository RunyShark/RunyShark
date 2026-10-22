// Call-to-action buttons in the vercel.com style: 40px pills, Geist 500 / 14px,
// one primary (light fill) and secondary ones (near-black fill, #2e2e2e hairline).
// Each button is its own transparent SVG so the README can link them one by one;
// widths come from the measured label so the row reads as one set.

import { links } from '../content.mjs'
import { glyph } from '../core/glyphs.mjs'
import { brandIcon } from '../core/icons.mjs'
import { linearGradient } from '../core/primitives.mjs'
import { createDoc, h } from '../core/svg.mjs'
import { centerBaseline, measure, txt } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'

const BTN_H = 40
const INSET = 1 // breathing room so the 1px hairline is never clipped by the <img> box
const FONT = { family: 'sans', weight: 500, size: 14, tracking: -0.005 }
const ICON = 16
const GAP = 8
const PAD = 16 // label side
const PAD_ICON = 14 // icon side (optically equal to PAD next to a 16px icon)
const GAP_TRAIL = 4 // the arrow glyph carries ~5px of built-in air on each side
const PAD_TRAIL = 12

const VARIANTS = {
  primary: { fill: color.text, stroke: null, text: color.surface, icon: color.surface },
  secondary: { fill: color.surface, stroke: color.borderStrong, text: color.text, icon: color.text },
}

const BUTTONS = [
  {
    id: 'email',
    variant: 'primary',
    label: 'Get in touch',
    lead: { glyph: 'mail' },
    desc: 'Primary button: Get in touch by email.',
    href: links.email,
  },
  {
    id: 'linkedin',
    variant: 'secondary',
    label: 'LinkedIn',
    lead: { brand: 'linkedin' },
    desc: 'Secondary button: connect on LinkedIn.',
    href: links.linkedin,
  },
  {
    id: 'github',
    variant: 'secondary',
    label: 'Follow on GitHub',
    lead: { brand: 'github' },
    desc: 'Secondary button: follow RunyShark on GitHub.',
    href: links.github,
  },
  {
    id: 'certifications',
    variant: 'secondary',
    label: 'View all certifications',
    trail: { glyph: 'arrowUpRight', fill: color.textSecondary },
    desc: 'Secondary button: view all certifications on LinkedIn.',
    href: links.linkedinCertifications,
  },
]

function icon(spec, x, cy, fill) {
  const y = cy - ICON / 2
  if (spec.glyph) return glyph(spec.glyph, { x, y, size: ICON, stroke: spec.fill ?? fill, strokeWidth: 1.6 })
  return brandIcon(spec.brand, { x, y, size: ICON, fill: spec.fill ?? fill }) ?? ''
}

function button(spec) {
  const v = VARIANTS[spec.variant]
  const labelW = Math.ceil(measure(spec.label, FONT))
  const left = spec.lead ? PAD_ICON + ICON + GAP : PAD
  const right = spec.trail ? GAP_TRAIL + ICON + PAD_TRAIL : PAD
  const w = left + labelW + right
  const width = w + INSET * 2
  const height = BTN_H + INSET * 2
  const doc = createDoc({ width, height, title: spec.label, desc: spec.desc })

  const x0 = INSET
  const y0 = INSET
  const cy = y0 + BTN_H / 2
  const r = BTN_H / 2
  const parts = []

  if (spec.variant === 'primary') {
    // Light pill with a barely-there vertical falloff, like a lit surface.
    const fid = linearGradient(
      doc,
      'btn-fill',
      [
        [0, '#f4f4f4'],
        [1, '#e4e4e4'],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    )
    parts.push(h('rect', { x: x0, y: y0, width: w, height: BTN_H, rx: r, fill: `url(#${fid})` }))
  } else {
    const fid = linearGradient(
      doc,
      'btn-fill',
      [
        [0, '#111111'],
        [1, v.fill],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    )
    parts.push(
      h('rect', {
        x: x0 + 0.5,
        y: y0 + 0.5,
        width: w - 1,
        height: BTN_H - 1,
        rx: r - 0.5,
        fill: `url(#${fid})`,
        stroke: v.stroke,
      }),
    )
    // Faint lit edge along the top of the hairline (Vercel card signature).
    const hid = linearGradient(
      doc,
      'btn-edge',
      [
        [0, '#ffffff', 0],
        [0.5, '#ffffff', 0.16],
        [1, '#ffffff', 0],
      ],
      { units: 'userSpaceOnUse', x1: x0 + r, y1: 0, x2: x0 + w - r, y2: 0 },
    )
    parts.push(h('path', { d: `M${x0 + r} ${y0 + 0.5}H${x0 + w - r}`, stroke: `url(#${hid})`, 'stroke-width': 1 }))
  }

  if (spec.lead) parts.push(icon(spec.lead, x0 + PAD_ICON, cy, v.icon))
  parts.push(
    txt(x0 + left, centerBaseline(cy, FONT), spec.label, {
      ...FONT,
      fill: v.text,
    }),
  )
  if (spec.trail) parts.push(icon(spec.trail, x0 + left + labelW + GAP_TRAIL, cy, v.icon))

  return doc.render(parts)
}

export default {
  name: 'buttons',
  render() {
    return BUTTONS.map((spec) => ({ path: `assets/buttons/${spec.id}.svg`, svg: button(spec) }))
  },
}
