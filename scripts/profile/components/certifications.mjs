// Certifications summary: a compact black panel laid out like a Vercel stats
// table — the shared toolbar, then three cells split by hairline guides with "+"
// crosshairs where the grid meets. Each cell reads platform → status → KPI, with
// a faint halftone patch (Aceternity pixelated-canvas) in its lower-right corner.
// The "in progress" cell borrows Vercel's Building state: amber dot + a slow
// light sweep along its top rule.
//
// Motion (DESIGN.md rule 6, v2): a faint starfield behind the cells, a slow amber
// border beam round the panel, and a shine crossing the three cells in turn.
// Everything a person reads is static; the shine rests off-cell.

import { certifications } from '../content.mjs'
import { glyph } from '../core/glyphs.mjs'
import { crosshair, iconTile, linearGradient, statusDot } from '../core/primitives.mjs'
import { createDoc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'
import { shineSweep, starfield } from '../core/motion.mjs'
import { PANEL, TYPE, panelHeader } from './shared/panel.mjs'

const W = layout.width
const HEAD = PANEL.toolbar // 64, the shared toolbar
const PAD = PANEL.pad // 32: cell padding = panel padding, so every cell sits on the same grid
const TILE = 36
const ROW_GAP = 20
const KPI = TYPE.kpi // 32/600 panel KPI (DESIGN.md rule 3)
const UNIT = { family: 'sans', weight: 400, size: 14 }
const TITLE = { family: 'sans', weight: 500, size: 14, tracking: -0.005 }
const TAG = { family: 'mono', weight: 400, size: 12, tracking: 0.06 }
const CHIP = { family: 'sans', weight: 500, size: 13 }
const KPI_ROW = 28 // KPI / chip row height
const H = HEAD + PAD + TILE + ROW_GAP + KPI_ROW + PAD
const SHINE = { period: 10, step: 1.1 } // s between cells, left → right

// Copy that content.mjs does not carry (layout-level labels only).
const COPY = {
  title: 'Credentials',
  subtitle: 'Udemy · DevTalles · continuous learning',
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

function chip(x, cy, text, { lead, padX = 12 } = {}) {
  const tw = measure(text, CHIP)
  const ph = 28
  const leadW = lead ? 14 : 0
  const w = Math.ceil(padX + leadW + tw + padX)
  return {
    w,
    markup: [
      h('rect', { x: x + 0.5, y: cy - ph / 2 + 0.5, width: w - 1, height: ph - 1, rx: ph / 2, fill: color.surface2, stroke: color.borderStrong }),
      lead ? h('circle', { cx: x + 12 + 3, cy, r: 3, fill: lead }) : '',
      txt(x + padX + leadW, centerBaseline(cy, CHIP), text, { ...CHIP, fill: color.text }),
    ].join(''),
  }
}

/**
 * Border beam without a blur filter. The README shows ~20 animated SVGs at once and
 * an SVG <img> is re-rasterised on every animation frame, so a feGaussianBlur on a
 * moving stroke costs a full filter pass per frame. The glow is a wide, faint twin
 * stroke instead. Butt caps: a zero-length dash with round caps would leave a dot.
 * Rest state: the segment sits just past the top-left corner.
 */
function beam(doc, { x = 0, y = 0, w, h: hh, r = 16, color: c, duration = 12, delay = 0, length = 80, width = 1.25 }) {
  doc.css('@keyframes bm-beam{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}.bm-beam{animation:bm-beam 12s linear infinite}')
  const L = Math.max(10, Math.min(500, Math.round(length)))
  const head = Math.max(6, Math.round(L * 0.35))
  const [X, Y, X1, Y1] = [x + 0.5, y + 0.5, x + w - 0.5, y + hh - 0.5].map(r2)
  const d = `M${X + r} ${Y}H${X1 - r}A${r} ${r} 0 0 1 ${X1} ${Y + r}V${Y1 - r}A${r} ${r} 0 0 1 ${X1 - r} ${Y1}H${X + r}A${r} ${r} 0 0 1 ${X} ${Y1 - r}V${Y + r}A${r} ${r} 0 0 1 ${X + r} ${Y}Z`
  const common = { d, pathLength: 1000, fill: 'none', 'stroke-dashoffset': 940, class: 'bm-beam', style: `animation-duration:${duration}s;animation-delay:-${r2(delay)}s` }
  const dash = `${L} ${1000 - L}`
  return h(
    'g',
    {},
    h('path', { ...common, stroke: c, 'stroke-width': r2(width * 4), 'stroke-opacity': 0.14, 'stroke-dasharray': dash }),
    h('path', { ...common, stroke: c, 'stroke-width': width, 'stroke-opacity': 0.5, 'stroke-dasharray': dash }),
    h('path', { ...common, stroke: '#ffffff', 'stroke-width': width, 'stroke-opacity': 0.9, 'stroke-dasharray': `0 ${L - head} ${head} ${1000 - L}` }),
  )
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

  // Ambient sky: kept off the caption copy and each cell's content block.
  const contentW = 230
  back.push(
    starfield(doc, {
      x: 6,
      y: 6,
      w: W - 12,
      h: H - 12,
      count: 64,
      seed: 'certifications',
      flares: 2,
      opacity: 0.65,
      avoid: [
        { x: PAD - 8, y: 8, w: 330, h: HEAD - 16 }, // tile + title + subtitle
        { x: W - PAD - 200, y: 8, w: 206, h: HEAD - 16 }, // pill
        ...xs.map((x0) => ({ x: x0 + PAD - 8, y: HEAD + PAD - 8, w: contentW, h: TILE + ROW_GAP + KPI_ROW + 16 })),
      ],
    }),
  )

  // Shared toolbar (DESIGN.md rule 1); the total rides in a neutral pill.
  const toolbar = panelHeader(doc, {
    icon: { glyph: 'graduation' },
    title: COPY.title,
    subtitle: COPY.subtitle,
    pills: total ? [{ label: `${total}+ certificates`, glyph: 'shieldCheck' }] : [],
    rule: false,
  })
  front.push(toolbar.markup)

  // Grid guides
  front.push(h('path', { d: `M0 ${HEAD + 0.5}H${W}`, stroke: color.border }))
  for (const x of xs.slice(1)) front.push(h('path', { d: `M${x + 0.5} ${HEAD}V${H}`, stroke: color.border }))

  const cells = [
    { brand: 'udemy', value: udemy ? `${udemy}+` : '—', ...COPY.udemy, dot: color.greenBright },
    { glyph: 'award', value: devtalles ? String(devtalles) : '—', ...COPY.devtalles, dot: color.greenBright },
    { glyph: 'trendingUp', ...COPY.learning, dot: color.amber, building: true },
  ]

  cells.forEach((c, i) => {
    const x = xs[i] + PAD
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
      // static dot: the shared pulse loops in 2.4 s (< 3 s); "building" motion is the top-rule sweep
      statusDot(doc, x + TILE + 12 + 3, top + 28, { fill: c.dot, r: 3, pulse: false }),
      txt(x + TILE + 12 + 12, r2(centerBaseline(top + 28, TAG)), c.status.toUpperCase(), { ...TAG, fill: color.textTertiary }),
    )

    // Shine across the cell, staggered left → right.
    back.push(
      shineSweep(doc, {
        x: xs[i] + 1,
        y: HEAD + 1,
        w: ws[i] - 1,
        h: H - HEAD - 1,
        r: 0,
        duration: SHINE.period,
        delay: r2((SHINE.period - i * SHINE.step) % SHINE.period),
        opacity: 0.07,
        band: 110,
      }),
    )

    const rowTop = top + TILE + ROW_GAP
    if (c.tracks) {
      // tighten the chips (not the copy) when the row would overflow the cell
      const room = ws[i] - PAD * 2
      const natural = c.tracks.reduce((n, t) => n + chip(0, 0, t).w, 0) + 8 * (c.tracks.length - 1)
      const padX = natural <= room ? 12 : 10
      let cx = x
      const cy = rowTop + KPI_ROW / 2
      for (const t of c.tracks) {
        const ch = chip(cx, cy, t, { padX })
        front.push(ch.markup)
        cx += ch.w + 8
      }
    } else {
      const baseline = rowTop + KPI_ROW - 2
      const vw = measure(c.value, KPI)
      front.push(
        txt(x - 1.5, baseline, c.value, { ...KPI, fill: `url(#${kpiFill})`, attrs: { style: 'font-variant-numeric:tabular-nums' } }),
        txt(x - 1.5 + vw + 6, baseline, c.unit, { ...UNIT, fill: color.textSecondary }),
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

  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, back, front),
    beam(doc, { x: 0, y: 0, w: W, h: H, r: 16, color: color.amber, duration: 14, delay: 4, length: 70, width: 1.25 }),
  )
}

export default {
  name: 'certifications',
  render() {
    return [{ path: 'assets/certifications.svg', svg: render() }]
  },
}
