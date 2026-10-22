// Certifications summary: a compact black panel laid out like a Vercel stats
// table — caption row, then three cells split by hairline guides with "+"
// crosshairs where the grid meets. Each cell reads platform → status → KPI, with
// a faint halftone patch (Aceternity pixelated-canvas) in its lower-right corner.
// The "in progress" cell borrows Vercel's Building state: amber dot + a slow
// light sweep along its top rule.

import { certifications } from '../content.mjs'
import { glyph } from '../core/glyphs.mjs'
import { crosshair, eyebrow, iconTile, linearGradient, statusDot } from '../core/primitives.mjs'
import { createDoc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'

const W = layout.width
const HEAD = 48 // caption row
const PAD = 24 // cell padding
const EDGE = 32 // outer text inset (matches every other panel)
const TILE = 36
const ROW_GAP = 22
const KPI = { family: 'sans', weight: 600, size: 40, tracking: -0.04 }
const UNIT = { family: 'sans', weight: 400, size: 14 }
const TITLE = { family: 'sans', weight: 500, size: 14, tracking: -0.005 }
const TAG = { family: 'mono', weight: 400, size: 11, tracking: 0.06 }
const CHIP = { family: 'sans', weight: 500, size: 13 }
const CAPTION = { family: 'mono', weight: 400, size: 12 }
const H = HEAD + PAD + TILE + ROW_GAP + 30 + PAD + 1

// Copy that content.mjs does not carry (layout-level labels only).
const COPY = {
  caption: 'Credentials',
  udemy: { title: 'Udemy', unit: 'certificates', status: 'Verified' },
  devtalles: { title: 'DevTalles', unit: 'certificates', status: 'Verified' },
  learning: { title: 'Continuous learning', status: 'In progress', tracks: ['Python', 'Cloud Architecture'] },
}

function count(n) {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

// Deterministic 0..1 hash (no Math.random: output must be byte-stable).
function hash(a, b, c = 0) {
  let x = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return (x >>> 0) / 4294967295
}

const r2 = (v) => Math.round(v * 100) / 100

// Halftone patch growing towards (cx, cy): dot size follows a radial falloff,
// with a seeded dropout so it reads as sampled pixels rather than a pattern.
function halftone(cx, cy, { radius = 150, step = 6, seed = 0, maxR = 1.7 } = {}) {
  const dots = []
  for (let gy = 0; gy * step <= radius; gy++) {
    for (let gx = 0; gx * step <= radius; gx++) {
      const x = cx - gx * step - step / 2
      const y = cy - gy * step - step / 2
      const d = Math.hypot(gx * step, gy * step) / radius
      if (d >= 1) continue
      const v = (1 - d) ** 1.5
      if (hash(gx, gy, seed) < 0.08 + (1 - v) * 0.6) continue
      const r = 0.45 + maxR * v
      dots.push(`M${r2(x - r)} ${r2(y)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`)
    }
  }
  return dots.join('')
}

function chip(x, cy, text, { lead } = {}) {
  const tw = measure(text, CHIP)
  const ph = 28
  const leadW = lead ? 14 : 0
  const w = Math.ceil(12 + leadW + tw + 12)
  return {
    w,
    markup: [
      h('rect', { x: x + 0.5, y: cy - ph / 2 + 0.5, width: w - 1, height: ph - 1, rx: ph / 2, fill: color.surface2, stroke: color.borderStrong }),
      lead ? h('circle', { cx: x + 12 + 3, cy, r: 3, fill: lead }) : '',
      txt(x + 12 + leadW, centerBaseline(cy, CHIP), text, { ...CHIP, fill: color.text }),
    ].join(''),
  }
}

function render() {
  const udemy = count(certifications?.udemyCount)
  const devtalles = count(certifications?.devtallesCount)
  const total = (udemy ?? 0) + (devtalles ?? 0)

  const summary = [
    udemy ? `${udemy}+ Udemy certificates` : null,
    devtalles ? `${devtalles} DevTalles certificates` : null,
    'continuous learning with Python and Cloud Architecture in progress',
  ].filter(Boolean)
  const doc = createDoc({
    width: W,
    height: H,
    title: 'Certifications',
    desc: `${summary.join(', ').replace(/^./, (c) => c.toUpperCase())}.`,
  })
  const clip = panelClip(doc)
  const cellsClip = doc.def('cells-clip', h('clipPath', { id: 'cells-clip' }, h('rect', { x: 0, y: HEAD + 1, width: W, height: H - HEAD - 1 })))

  const xs = [0, Math.round(W / 3), Math.round((W * 2) / 3)]
  const ws = [xs[1], xs[2] - xs[1], W - xs[2]]

  const kpiFill = linearGradient(
    doc,
    'kpi-fill',
    [
      [0, '#ffffff'],
      [1, '#9a9a9a'],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  )

  const back = []
  const front = []

  // Caption row
  const headCy = HEAD / 2
  front.push(eyebrow(EDGE, centerBaseline(headCy, CAPTION), COPY.caption))
  if (total) {
    const label = `${total}+ certificates`
    const lw = measure(label, { size: 13 })
    front.push(
      glyph('shieldCheck', { x: W - EDGE - lw - 22, y: headCy - 8, size: 16, stroke: color.textTertiary, strokeWidth: 1.5 }),
      txt(W - EDGE, centerBaseline(headCy, { size: 13 }), label, { size: 13, fill: color.textSecondary, anchor: 'end' }),
    )
  }

  // Grid guides
  front.push(h('path', { d: `M0 ${HEAD + 0.5}H${W}`, stroke: color.border }))
  for (const x of xs.slice(1)) front.push(h('path', { d: `M${x + 0.5} ${HEAD}V${H}`, stroke: color.border }))

  const cells = [
    { brand: 'udemy', value: udemy ? `${udemy}+` : '—', ...COPY.udemy, dot: color.greenBright },
    { glyph: 'award', value: devtalles ? String(devtalles) : '—', ...COPY.devtalles, dot: color.greenBright },
    { glyph: 'trendingUp', ...COPY.learning, dot: color.amber, building: true },
  ]

  cells.forEach((c, i) => {
    const x = i === 0 ? EDGE : xs[i] + PAD
    const top = HEAD + PAD

    // Halftone patch, lower-right corner of the cell.
    back.push(
      h('path', {
        d: halftone(xs[i] + ws[i], H, { seed: i + 1, radius: 132 }),
        fill: c.building ? color.amber : '#ffffff',
        opacity: c.building ? 0.26 : 0.16,
        'clip-path': `url(#${cellsClip})`,
      }),
    )

    front.push(
      iconTile(doc, { x, y: top, size: TILE, glyph: c.glyph, brand: c.brand, iconColor: color.text, iconSize: 18 }),
      txt(x + TILE + 12, top + 15, c.title, { ...TITLE, fill: color.text }),
      statusDot(doc, x + TILE + 12 + 3, top + 28, { fill: c.dot, r: 3, pulse: Boolean(c.building) }),
      txt(x + TILE + 12 + 12, top + 28 + 3.9, c.status.toUpperCase(), { ...TAG, fill: color.textTertiary }),
    )

    const rowTop = top + TILE + ROW_GAP
    if (c.tracks) {
      let cx = x
      const cy = rowTop + 15
      for (const t of c.tracks) {
        const ch = chip(cx, cy, t)
        front.push(ch.markup)
        cx += ch.w + 8
      }
    } else {
      const baseline = rowTop + 29
      const vw = measure(c.value, KPI)
      front.push(
        txt(x - 1.5, baseline, c.value, { ...KPI, fill: `url(#${kpiFill})`, attrs: { style: 'font-variant-numeric:tabular-nums' } }),
        txt(x - 1.5 + vw + 8, baseline, c.unit, { ...UNIT, fill: color.textSecondary }),
      )
    }

    if (c.building) {
      // Vercel "Building" sweep: an amber highlight travelling along the cell's top rule.
      const x0 = xs[i] + 1
      const x1 = W
      const seg = 140
      const gid = linearGradient(
        doc,
        'sweep',
        [
          [0, color.amber, 0],
          [0.7, color.amber, 0.9],
          [1, '#ffe2a8', 0],
        ],
        { units: 'userSpaceOnUse', x1: x0 - seg, y1: 0, x2: x0, y2: 0 },
      )
      const sweepClip = doc.def(
        'sweep-clip',
        h('clipPath', { id: 'sweep-clip' }, h('rect', { x: x0, y: HEAD - 2, width: x1 - x0, height: 5 })),
      )
      doc.css(`@keyframes cert-sweep{0%{transform:translateX(0)}70%,100%{transform:translateX(${x1 - x0 + seg}px)}}
.cert-sweep{animation:cert-sweep 4.2s cubic-bezier(.4,0,.2,1) infinite}`)
      front.push(
        h(
          'g',
          { 'clip-path': `url(#${sweepClip})` },
          h('path', { d: `M${x0 - seg} ${HEAD + 0.5}H${x0}`, stroke: `url(#${gid})`, 'stroke-width': 1, class: 'cert-sweep' }),
        ),
      )
    }
  })

  // "+" crosshairs where the dividers meet the caption rule.
  for (const x of xs.slice(1)) front.push(crosshair(x + 0.5, HEAD + 0.5, { stroke: color.textMuted }))

  return doc.render(panel(doc), h('g', { 'clip-path': `url(#${clip})` }, back, front))
}

export default {
  name: 'certifications',
  render() {
    return [{ path: 'assets/certifications.svg', svg: render() }]
  },
}
