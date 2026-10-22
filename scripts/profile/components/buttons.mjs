// Call-to-action buttons in the vercel.com style: 40px pills, Geist 500 / 14px,
// one primary (light fill) and secondary ones (near-black fill, #2e2e2e hairline).
// Each button is its own transparent SVG so the README can link them one by one;
// widths come from the measured label so the row reads as one set.
//
// Motion (DESIGN.md rule 6, v2): the primary button gets a slow shine sweep,
// each secondary one a soft glint gliding along its top hairline, phases
// staggered so the row never moves in unison. Labels never move; at rest the
// shine is off-pill and the glint is hidden (the static lit edge stays).
// (A perimeter border beam was tried: on a 40px pill its fragments wrapping the
// round ends read as rendering glitches, and its blur filter cost a filter pass
// per frame. The glint is one transform/opacity-animated <g>, no filter.)

import { links } from '../content.mjs'
import { glyph } from '../core/glyphs.mjs'
import { brandIcon } from '../core/icons.mjs'
import { linearGradient } from '../core/primitives.mjs'
import { createDoc, h } from '../core/svg.mjs'
import { centerBaseline, measure, txt } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'
import { shineSweep } from '../core/motion.mjs'

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

// Per-button motion phase (s), so neighbours never sync.
const MOTION = {
  shine: { duration: 7, delay: 1.5, opacity: 0.85 },
  glint: { duration: 7.5, opacity: 0.75 },
  phase: { linkedin: 0.8, github: 3.3, certifications: 5.8 },
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

// Edge glint: a short soft-ended streak of light gliding left → right along the
// pill's top hairline during the first half of the loop, hidden the second half.
function edgeGlint(doc, { x1, x2, y, duration, delay, opacity }) {
  const len = Math.round(Math.min(56, (x2 - x1) * 0.5))
  const travel = Math.round(x2 - x1 - len)
  const line = linearGradient(doc, 'btn-glint', [
    [0, '#ffffff', 0],
    [0.7, '#ffffff', 0.9],
    [1, '#ffffff', 0],
  ])
  const name = `btn-glint-${travel}`
  doc.css(`@keyframes ${name}{0%{transform:translateX(0);opacity:0}12%{opacity:1}38%{opacity:1}50%,100%{transform:translateX(${travel}px);opacity:0}}
.${name}{animation:${name} ${duration}s cubic-bezier(.4,0,.6,1) infinite}`)
  return h(
    'g',
    { opacity: 0, class: name, style: delay ? `animation-delay:-${delay}s` : null },
    h('rect', { x: Math.round(x1 * 100) / 100, y: y - 0.5, width: len, height: 1, fill: `url(#${line})`, opacity }),
  )
}

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
    parts.push(shineSweep(doc, { x: x0, y: y0, w, h: BTN_H, r, ...MOTION.shine, angle: 22, band: 56 }))
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
    parts.push(edgeGlint(doc, { x1: x0 + r * 0.7, x2: x0 + w - r * 0.7, y: y0 + 0.5, ...MOTION.glint, delay: MOTION.phase[spec.id] ?? 0 }))
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
