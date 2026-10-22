// Closing panel — the hero's bookend. Same grid (guides on the 32px padding,
// "+" crosshairs, a 64px bar mirroring the hero's top bar), a miniature
// dot-matrix "RunyShark" sampled from vendor/wordmark.json with a slow light
// sweep, faint drifting haze along the floor, the build provenance and a
// Vercel-style status pill (its dot pulses). v2: an agent constellation behind
// the identity block — twinkling nodes with data pulses travelling the edges —
// echoing "orchestrated with AI agents" (DESIGN.md rule 6). The copy and the
// freshness date never move.
//
// Performance: no filters. The floor haze is pre-blurred radial gradients (an
// feTurbulence layer under a drifting transform re-ran the noise every frame),
// and the sweep's mask is limited to the wordmark's box.

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
import { constellation, starfield } from '../core/motion.mjs'

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
  credit: ['Designed & engineered by ', profile.login ?? 'RunyShark', ' · orchestrated with AI agents'],
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
  // Light sweep: a white band masked by the dots, crossing every ~9s then resting.
  doc.def(
    'ft-wm-mask',
    h(
      'mask',
      { id: 'ft-wm-mask', maskUnits: 'userSpaceOnUse', x: box.x - 16, y: box.y - 16, width: box.w + 32, height: box.h + 32 },
      h('use', { href: '#ft-wm', fill: '#fff' }),
    ),
  )
  const band = 70
  // Achromatic on purpose (a whisper of cool lead / warm tail): a blue→orange
  // band read as a colour cast on the mark rather than light on metal.
  const sweep = linearGradient(
    doc,
    'ft-wm-sweep',
    [
      [0, '#eef3ff', 0],
      [0.38, '#eef3ff', 0.55],
      [0.55, '#ffffff', 1],
      [0.75, '#fff6ec', 0.4],
      [1, '#fff6ec', 0],
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

// Faint haze hugging the floor: three pre-blurred radial-gradient banks (cool
// silver-blue, lavender, pale) drifting slowly sideways. transform only.
function clouds(doc) {
  const banks = [
    { id: 'ft-haze-a', cx: 170, cy: 176, rx: 280, ry: 46, c: '#8ea6ff', o: 0.075 },
    { id: 'ft-haze-b', cx: 520, cy: 190, rx: 320, ry: 50, c: '#a78bfa', o: 0.06 },
    { id: 'ft-haze-c', cx: 790, cy: 170, rx: 240, ry: 40, c: '#cfe3ff', o: 0.055 },
  ]
  doc.css(`@keyframes ft-drift{from{transform:translateX(-36px)}to{transform:translateX(36px)}}
.ft-drift{animation:ft-drift 48s ease-in-out infinite alternate}`)
  return h(
    'g',
    { class: 'ft-drift' },
    banks.map((k) => {
      const g = radialGradient(doc, k.id, [
        [0, k.c, k.o],
        [0.5, k.c, r2(k.o * 0.4)],
        [1, k.c, 0],
      ])
      return h('ellipse', { cx: k.cx, cy: k.cy, rx: k.rx, ry: k.ry, fill: `url(#${g})` })
    }),
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
  const [lead, name, tail] = COPY.credit
  const creditW = measure(lead, creditOpts) + measure(name, { ...creditOpts, weight: 500 }) + measure(tail, creditOpts)
  const credit = txt(r2(CX - creditW / 2), creditY, '', {
    ...creditOpts,
    fill: color.textTertiary,
    content: `${esc(lead)}<tspan class="f-sans-500" fill="${color.text}">${esc(name)}</tspan>${esc(tail)}`,
  })

  // Agent constellation behind the identity block, clear of the mark and the credit.
  const identityW = Math.max(mark.box.w, creditW)
  const identityBox = { x: CX - identityW / 2 - 28, y: mark.box.y - 14, w: identityW + 56, h: creditY + 10 - (mark.box.y - 14) }
  const net = constellation(doc, {
    x: GUIDE_L + 12,
    y: 12,
    w: GUIDE_R - GUIDE_L - 24,
    h: RULE - 24,
    nodes: 26,
    seed: 'footer',
    k: 2,
    pulses: 5,
    edgeOpacity: 0.1,
    nodeR: [1, 1.9],
    pulseDuration: 5.5,
    avoid: [identityBox],
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
    ? `${esc(COPY.rendered)}<tspan fill="${color.textTertiary}"> · </tspan>${esc(COPY.updated)} <tspan class="f-sans-500" fill="${color.textSecondary}">${esc(updated)}</tspan>`
    : esc(COPY.rendered)

  return doc.render(
    panel(doc),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      clouds(doc),
      starfield(doc, { x: 8, y: 6, w: W - 16, h: RULE - 10, count: 46, seed: 'footer', twinkle: 0.6, opacity: 0.55, avoid: [identityBox] }),
      h('g', { opacity: 0.85 }, net.markup),
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
