// Closing panel — the hero's bookend. Same grid (guides on the 32px padding,
// "+" crosshairs, a 64px bar mirroring the hero's top bar), a miniature
// dot-matrix "RunyShark" sampled from vendor/wordmark.json with a slow light
// sweep, faint drifting clouds along the floor, the build provenance and a
// Vercel-style status pill.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { profile } from '../content.mjs'
import { date } from '../core/format.mjs'
import { brandIcon } from '../core/icons.mjs'
import { crosshair, guide, linearGradient, pill, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor')
const wordmark = JSON.parse(fs.readFileSync(path.join(vendor, 'wordmark.json'), 'utf8'))

const W = layout.width
const H = 188
const GUIDE_L = 32
const GUIDE_R = W - 32
const INSET = 20
const BAR = 60 // bottom bar (the hero's top bar, mirrored)
const RULE = H - BAR
const CX = W / 2
const CELL = 3 // mini wordmark pitch: an integer, pixel-aligned, so 1x screens show no moiré

// Copy that content.mjs does not carry.
const COPY = {
  credit: ['Designed & engineered by ', profile.login ?? 'RunyShark'],
  rendered: 'Rendered daily by GitHub Actions',
  updated: 'last updated',
  status: 'All systems operational',
}

const r2 = (v) => Math.round(v * 100) / 100

function hash(a, b, c = 0) {
  let x = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return (x >>> 0) / 4294967295
}

function updatedOn(data) {
  const iso = data?.generatedAt
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? date(iso) : null
}

// Inked bounds of the source wordmark (ignores near-empty anti-alias cells).
function inkBounds() {
  let c0 = Infinity
  let c1 = -Infinity
  let r0 = Infinity
  let r1 = -Infinity
  for (const [c, r, v] of wordmark.dots) {
    if (v < 0.3) continue
    c0 = Math.min(c0, c)
    c1 = Math.max(c1, c)
    r0 = Math.min(r0, r)
    r1 = Math.max(r1, r)
  }
  return { c0, c1, r0, r1 }
}

function miniWordmark(doc, top) {
  const { c0, c1, r0, r1 } = inkBounds()
  const w = (c1 - c0 + 1) * CELL
  const x0 = Math.round(CX - w / 2 - c0 * CELL)
  const y0 = Math.round(top - r0 * CELL)
  const maxR = CELL / 2 - 0.3
  const dots = []
  for (const [c, r, cov] of wordmark.dots) {
    if (cov < 0.12) continue
    if (cov < 0.985 && hash(c, r, 7) < 0.06) continue // pixelated-canvas dropout
    const rad = Math.min(maxR, Math.max(0.5, maxR * Math.sqrt(cov)))
    dots.push(h('circle', { cx: r2(x0 + c * CELL + CELL / 2), cy: r2(y0 + r * CELL + CELL / 2), r: r2(rad) }))
  }
  doc.def('ft-wm', h('g', { id: 'ft-wm' }, dots))
  // cap = inked rows down to the baseline row (the y descender hangs below it)
  const baseRow = Math.floor(wordmark.baseline / wordmark.cell)
  const box = { x: x0 + c0 * CELL, y: top, w, h: (r1 - r0 + 1) * CELL, cap: (baseRow - r0 + 1) * CELL }

  const metal = linearGradient(
    doc,
    'ft-wm-metal',
    [
      [0, '#f2f2f2'],
      [0.55, '#bdbdbd'],
      [1, '#6f6f6f'],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: box.y, x2: 0, y2: box.y + box.h },
  )
  // Light sweep: a warm band masked by the dots, crossing every ~9s then resting.
  doc.def(
    'ft-wm-mask',
    h(
      'mask',
      { id: 'ft-wm-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      h('use', { href: '#ft-wm', fill: '#fff' }),
    ),
  )
  const band = 70
  const sweep = linearGradient(
    doc,
    'ft-wm-sweep',
    [
      [0, '#7aa7ff', 0],
      [0.38, '#e8ddff', 0.75],
      [0.55, '#fff6ea', 1],
      [0.75, '#ffb36b', 0.45],
      [1, '#ffb36b', 0],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 0.35 },
  )
  const travel = box.w + band * 2
  doc.css(`@keyframes ft-sweep{0%,18%{transform:translateX(0)}62%,100%{transform:translateX(${r2(travel)}px)}}
.ft-sweep{animation:ft-sweep 9s cubic-bezier(.45,0,.25,1) infinite}`)
  return {
    box,
    markup: [
      h('use', { href: '#ft-wm', fill: `url(#${metal})` }),
      h(
        'g',
        { mask: 'url(#ft-wm-mask)' },
        h('rect', {
          x: r2(box.x - band * 1.5),
          y: box.y - 4,
          width: band,
          height: box.h + 8,
          fill: `url(#${sweep})`,
          class: 'ft-sweep',
        }),
      ),
    ].join(''),
  }
}

// Faint procedural clouds hugging the floor (one feTurbulence, slow drift).
function clouds(doc) {
  const drift = 220
  doc.def(
    'ft-cloud',
    h(
      'filter',
      { id: 'ft-cloud', x: 0, y: 0, width: '100%', height: '100%', filterUnits: 'objectBoundingBox', 'color-interpolation-filters': 'sRGB' },
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.0035 0.011', numOctaves: 4, seed: 23, stitchTiles: 'stitch' }),
      h('feColorMatrix', {
        type: 'matrix',
        values: ['0 0.9 0 0 0.12', '0 0.2 0 0 0.5', '0 -0.6 0 0 1.12', '2.3 0 0 0 -0.98'].join(' '),
      }),
    ),
  )
  const fade = linearGradient(
    doc,
    'ft-cloud-fade',
    [
      [0, '#fff', 0],
      [0.45, '#fff', 0.35],
      [1, '#fff', 1],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: 40, x2: 0, y2: H },
  )
  doc.def(
    'ft-cloud-mask',
    h(
      'mask',
      { id: 'ft-cloud-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      h('rect', { y: 40, width: W, height: H - 40, fill: `url(#${fade})` }),
    ),
  )
  doc.css(`@keyframes ft-drift{from{transform:translateX(0)}to{transform:translateX(-${drift}px)}}
.ft-drift{animation:ft-drift 64s ease-in-out infinite alternate}`)
  return h(
    'g',
    { mask: 'url(#ft-cloud-mask)', opacity: 0.26 },
    h('g', { class: 'ft-drift' }, h('rect', { width: W + drift, height: H, fill: '#000', filter: 'url(#ft-cloud)' })),
  )
}

function grid() {
  const xs = [GUIDE_L + 0.5, GUIDE_R - 0.5]
  const y = RULE + 0.5
  return [
    guide(0, y, W, y),
    ...xs.map((x) => guide(x, 0, x, H)),
    ...xs.map((x) => crosshair(x, y, { size: 13, stroke: color.textMuted })),
  ].join('')
}

function render({ data }) {
  const updated = updatedOn(data)
  const doc = createDoc({
    width: W,
    height: H,
    title: `${COPY.credit.join('')}`,
    desc: [
      `${COPY.credit.join('')}.`,
      `${COPY.rendered}${updated ? `, ${COPY.updated} ${updated}` : ''}.`,
      `${COPY.status}.`,
    ].join(' '),
  })
  const clip = panelClip(doc)

  // Identity block: mini wordmark + credit line, optically centred above the rule.
  const creditOpts = { size: 13, weight: 400 }
  // Block = wordmark cap height + 30px to the credit baseline, centred above the rule.
  const capH = (Math.floor(wordmark.baseline / wordmark.cell) - inkBounds().r0 + 1) * CELL
  const mark = miniWordmark(doc, Math.round((RULE - (capH + 31)) / 2))
  const creditY = mark.box.y + mark.box.cap + 31
  const [lead, name] = COPY.credit
  const creditW = measure(lead, creditOpts) + measure(name, { ...creditOpts, weight: 500 })
  const credit = txt(r2(CX - creditW / 2), creditY, '', {
    ...creditOpts,
    fill: color.textTertiary,
    content: `${esc(lead)}<tspan class="f-sans-500" fill="${color.text}">${esc(name)}</tspan>`,
  })

  // Soft cool halo behind the mark, the way the hero lights its wordmark.
  const halo = radialGradient(doc, 'ft-halo', [
    [0, '#c9d6ff', 0.09],
    [0.6, '#8ea6ff', 0.025],
    [1, '#8ea6ff', 0],
  ])

  // Bottom bar: provenance (left) + status (right).
  const cy = RULE + BAR / 2
  const left = GUIDE_L + INSET
  const right = GUIDE_R - INSET
  const metaOpts = { size: 13, weight: 400 }
  const status = pill(doc, {
    x: right,
    y: cy - 14,
    text: COPY.status,
    dot: color.greenBright,
    align: 'end',
    size: 13,
    weight: 500,
    fill: color.surface,
    stroke: color.borderStrong,
    textFill: color.text,
  })
  const meta = updated
    ? `${esc(COPY.rendered)}<tspan fill="${color.textMuted}"> · </tspan>${esc(COPY.updated)} <tspan class="f-sans-500" fill="${color.textSecondary}">${esc(updated)}</tspan>`
    : esc(COPY.rendered)

  return doc.render(
    panel(doc),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      clouds(doc),
      h('ellipse', { cx: CX, cy: mark.box.y + mark.box.cap / 2, rx: 300, ry: 70, fill: `url(#${halo})` }),
      grid(),
      mark.markup,
      credit,
      brandIcon('github', { x: left, y: cy - 8, size: 16, fill: color.textTertiary }),
      txt(left + 26, centerBaseline(cy, metaOpts), '', { ...metaOpts, fill: color.textTertiary, content: meta }),
      status.markup,
    ),
  )
}

export default {
  name: 'footer',
  render({ data } = {}) {
    return [{ path: 'assets/generated/footer.svg', svg: render({ data: data ?? {} }) }]
  },
}
