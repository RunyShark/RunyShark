// About card — modelled on Vercel's amber-glow dashboard dialog: a halftone
// "pixelated canvas" orb avatar with a small amber badge, a centred headline and
// intro, then the eight highlights as bordered rows (icon tile + title + text)
// in a two-column grid. Static: ignores metrics.

import { about, profile, sections } from '../content.mjs'
import { hasGlyph } from '../core/glyphs.mjs'
import { card, crosshair, eyebrow, guide, iconTile, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel } from '../core/svg.mjs'
import { measure, truncate, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'

const W = layout.width
const PAD = layout.pad // panel → card
const CARD_PAD = 32 // card → content
const ORB_R = 42
const ORB_PITCH = 2.9 // halftone cell size (px)
const COL_GAP = 10
const ROW_GAP = 10
const ROW_PAD = 15
const TILE = 36
const TILE_GAP = 14

const TITLE = { size: 14, weight: 500 }
const TEXT = { size: 13, weight: 400 }
const INTRO = { size: 15, weight: 400 }
const HEAD = { size: 26, weight: 600, tracking: -0.035 }

// ---------------------------------------------------------------------------
// Deterministic pseudo-randomness (integer hash → [0, 1)).
function hash(i, j, seed = 0) {
  let x = Math.imul(i + 0x9e37, 0x85ebca6b) ^ Math.imul(j + 0x7f4a, 0xc2b2ae35) ^ Math.imul(seed + 1, 0x27d4eb2f)
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d)
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39)
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296
}

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const r2 = (v) => Math.round(v * 100) / 100

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return `#${ca
    .map((v, k) => Math.round(v + (cb[k] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`
}

// Piecewise-linear colour ramp: stops = [[t, '#hex'], ...].
function ramp(stops, t) {
  const v = clamp(t)
  for (let k = 1; k < stops.length; k++) {
    if (v <= stops[k][0]) {
      const [t0, c0] = stops[k - 1]
      const [t1, c1] = stops[k]
      return mixHex(c0, c1, (v - t0) / (t1 - t0 || 1))
    }
  }
  return stops.at(-1)[1]
}

// Shadow → light: deep violet, violet, magenta, pink, blush highlight.
const ORB_RAMP = [
  [0, '#4a2183'],
  [0.26, color.purple],
  [0.48, '#c24fb0'],
  [0.7, color.pink],
  [0.9, '#ff8fb8'],
  [1, '#ffd3e3'],
]
const ORB_RIM = color.purpleBright

// ---------------------------------------------------------------------------
// Halftone orb: a square dot grid clipped to a circle, each dot shaded as a
// point on a lit sphere (Lambert + Blinn specular), plus a violet rim light on
// the lower-right limb so the silhouette reads against the dark card.
function orb(doc, cx, cy, R) {
  const L = normalize([-0.5, -0.62, 0.6]) // light from the top-left, in front
  const Hv = normalize([L[0], L[1], L[2] + 1]) // half-vector with the viewer
  const n = Math.ceil(R / ORB_PITCH)
  const buckets = new Map()
  const sparkles = []

  for (let gy = -n; gy <= n; gy++) {
    for (let gx = -n; gx <= n; gx++) {
      // pixelated-canvas jitter: tiny deterministic offset per cell
      const jx = (hash(gx, gy, 1) - 0.5) * 0.45
      const jy = (hash(gx, gy, 2) - 0.5) * 0.45
      const px = gx * ORB_PITCH + jx
      const py = gy * ORB_PITCH + jy
      const u = px / R
      const v = py / R
      const d2 = u * u + v * v
      if (d2 > 1) continue
      const z = Math.sqrt(1 - d2)
      const N = [u, v, z]
      const diffuse = Math.max(0, dot(N, L))
      const spec = Math.max(0, dot(N, Hv)) ** 24
      const I = clamp(0.23 + diffuse * 0.7 + spec * 0.22)
      // backlight hugging the limb, strongest opposite the key light
      const rim = clamp((1 - z) ** 1.8 * clamp(0.15 + v * 0.55 + u * 0.55) * 1.6)

      const lit = Math.max(I, rim * 0.62)
      // dropout: only in the shadow, like a dithered print
      if (hash(gx, gy, 3) < 0.34 * clamp((0.56 - lit) / 0.56) ** 1.4) continue

      // halftone: the dot size carries the shading
      const radius = (ORB_PITCH / 2) * (0.2 + 0.76 * lit ** 0.9)
      // keep every dot inside the silhouette so the limb reads as a clean circle
      if (Math.sqrt(d2) * R + radius * 0.35 > R) continue
      const li = Math.round(I * 14)
      const ri = Math.round(rim * 4)
      const key = li * 10 + ri
      if (!buckets.has(key)) buckets.set(key, { li, ri, dots: [] })
      buckets.get(key).dots.push(h('circle', { cx: r2(cx + px), cy: r2(cy + py), r: r2(radius) }))

      // twinkle candidates: mid-lit dots, chosen by hash
      if (I > 0.5 && I < 0.9 && hash(gx, gy, 4) < 0.05) sparkles.push([cx + px, cy + py, radius])
    }
  }

  const groups = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, { li, ri, dots }]) => {
      const t = li / 14
      const r = ri / 4
      const fill = mixHex(ramp(ORB_RAMP, t), ORB_RIM, r * 0.7)
      const opacity = clamp(0.55 + 0.45 * t ** 0.7 + r * 0.3)
      return h('g', { fill, opacity: opacity >= 0.995 ? null : r2(opacity) }, dots)
    })

  doc.css(`@keyframes orb-twinkle{0%,62%,100%{opacity:0}78%{opacity:1}}
.orb-tw{opacity:0;animation:orb-twinkle 5.2s ease-in-out infinite}`)
  const twinkles = sparkles.slice(0, 18).map(([x, y], k) =>
    h('circle', {
      cx: r2(x),
      cy: r2(y),
      r: r2(ORB_PITCH * 0.46),
      fill: '#fff4f8',
      class: 'orb-tw',
      style: `animation-delay:${r2(-(hash(k, 7, 5) * 5.2))}s`,
    }),
  )

  return [...groups, h('g', {}, twinkles)].join('')
}

function normalize([x, y, z]) {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// Custom glyph for the badge: a shark fin over a waterline (RunyShark).
function sharkFin(x, y, size, fill) {
  const s = size / 24
  return h(
    'g',
    { transform: `translate(${r2(x)} ${r2(y)}) scale(${r2(s * 1000) / 1000})` },
    h('path', {
      d: 'M3.5 17.2C7.6 15.4 11 10.9 13.4 4.6c.5-1.3 2.2-1.2 2.4.2.7 4.9 1.9 9.1 4.9 12.4Z',
      fill,
    }),
    h('path', {
      d: 'M2.5 20.6c1.6 0 2.4-.9 4-.9s2.4.9 4 .9 2.4-.9 4-.9 2.4.9 4 .9 2.4-.9 3-.9',
      stroke: fill,
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
      fill: 'none',
    }),
  )
}

function avatar(doc, cx, cy) {
  const bloom = radialGradient(doc, 'orb-bloom', [
    [0, color.pink, 0.26],
    [0.45, color.purple, 0.1],
    [1, color.purple, 0],
  ])
  const ringFade = linearGradient(
    doc,
    'orb-ring',
    [
      [0, '#ffffff', 0.16],
      [0.5, '#ffffff', 0.04],
      [1, '#ffffff', 0.1],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 1 },
  )
  doc.css(`@keyframes orb-orbit{to{transform:rotate(360deg)}}
.orb-orbit{transform-box:fill-box;transform-origin:center;animation:orb-orbit 90s linear infinite}`)

  // badge sits on the orb's rim at 45° (lower right)
  const bR = 11.5
  const bx = cx + (ORB_R - 3) * Math.SQRT1_2
  const by = cy + (ORB_R - 3) * Math.SQRT1_2
  const badgeFill = linearGradient(
    doc,
    'badge-fill',
    [
      [0, '#ffc560'],
      [0.55, color.amber],
      [1, '#d9870c'],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  )

  return [
    h('circle', { cx, cy, r: ORB_R * 2.1, fill: `url(#${bloom})` }),
    h('circle', { cx, cy, r: ORB_R + 9.5, stroke: `url(#${ringFade})`, 'stroke-width': 1 }),
    h('circle', {
      cx,
      cy,
      r: ORB_R + 19.5,
      stroke: '#ffffff',
      'stroke-opacity': 0.09,
      'stroke-dasharray': '1 5',
      'stroke-linecap': 'round',
      class: 'orb-orbit',
    }),
    orb(doc, cx, cy, ORB_R),
    // badge: card-coloured cut-out ring, amber disc, dark glyph
    h('circle', { cx: r2(bx), cy: r2(by), r: bR + 3, fill: color.surface }),
    h('circle', { cx: r2(bx), cy: r2(by), r: bR, fill: `url(#${badgeFill})` }),
    h('circle', { cx: r2(bx), cy: r2(by), r: bR - 0.5, stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': 1, fill: 'none' }),
    sharkFin(bx - 7.5, by - 7.9, 15, '#1f1300'),
  ].join('')
}

// Faint halftone dot field under the glow — echoes the orb's texture.
function dotField(doc, x, y, w, hgt) {
  const pid = doc.def(
    'about-dots',
    h(
      'pattern',
      { id: 'about-dots', x: x + 2, y: y + 2, width: 8, height: 8, patternUnits: 'userSpaceOnUse' },
      h('circle', { cx: 1, cy: 1, r: 0.75, fill: '#ffffff' }),
    ),
  )
  const fade = radialGradient(
    doc,
    'about-dots-fade',
    [
      [0, '#ffffff', 0.5],
      [0.6, '#ffffff', 0.12],
      [1, '#ffffff', 0],
    ],
    { cx: 0.5, cy: 0, r: 0.6 },
  )
  const mid = doc.def(
    'about-dots-mask',
    h(
      'mask',
      { id: 'about-dots-mask', maskUnits: 'userSpaceOnUse', x, y, width: w, height: hgt },
      h('rect', { x, y, width: w, height: hgt, fill: `url(#${fade})` }),
    ),
  )
  return h('rect', { x, y, width: w, height: hgt, fill: `url(#${pid})`, mask: `url(#${mid})`, opacity: 0.14 })
}

// Row metrics: cap-top of the title to the descender of the last text line.
const TITLE_CAP = 10
const TITLE_TO_TEXT = 20
const TEXT_LH = 18
const DESCENDER = 3

function rowHeight(lines) {
  return ROW_PAD + TITLE_CAP + TITLE_TO_TEXT + (lines - 1) * TEXT_LH + DESCENDER + ROW_PAD
}

function row(doc, item, { x, y, w, rowH, lines }) {
  const textX = x + ROW_PAD + TILE + TILE_GAP
  const textW = w - (textX - x) - ROW_PAD
  const title = truncate(item.title ?? '', textW, TITLE)
  // centre the text block (and the tile) vertically in the row
  const blockH = TITLE_CAP + (lines.length ? TITLE_TO_TEXT + (lines.length - 1) * TEXT_LH + DESCENDER : 0)
  const titleY = y + (rowH - blockH) / 2 + TITLE_CAP
  const glyphName = hasGlyph(item.glyph) ? item.glyph : null
  return [
    h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: rowH - 1, rx: 10, fill: color.surface, stroke: color.border }),
    iconTile(doc, {
      x: x + ROW_PAD,
      y: y + (rowH - TILE) / 2,
      size: TILE,
      glyph: glyphName,
      label: item.title,
      iconColor: color.text,
    }),
    txt(textX, titleY, title, { ...TITLE, fill: color.text }),
    lines.map((line, k) =>
      txt(textX, titleY + TITLE_TO_TEXT + k * TEXT_LH, line, { ...TEXT, fill: color.textSecondary }),
    ),
  ].join('')
}

// Word tokens that should not be split across lines: proper-noun pairs
// ("React Native", "System Design") and "&" bound to the following word.
// Glued tokens stay short (≤ 3 words) and never exceed the line width.
function tokens(text, width, opts) {
  const out = []
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const prev = out.at(-1)
    const prevWords = prev ? prev.split(' ') : []
    const last = prevWords.at(-1) ?? ''
    const proper = /^[A-Z]/.test(last) && /^[A-Z&]/.test(word) && !/[,.;:!?]$/.test(last)
    const glue = prev && prevWords.length < 3 && (proper || last === '&')
    if (glue && measure(`${prev} ${word}`, opts) <= width) out[out.length - 1] = `${prev} ${word}`
    else out.push(word)
  }
  return out
}

function greedy(toks, width, opts) {
  const lines = []
  let line = ''
  for (const tok of toks) {
    const next = line ? `${line} ${tok}` : tok
    if (line && measure(next, opts) > width) {
      lines.push(line)
      line = tok
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

// Balanced wrap (CSS `text-wrap: balance`): same line count as a greedy wrap,
// but the narrowest width that still achieves it — no lonely last words.
function balance(text, width, opts) {
  const toks = tokens(text, width, opts)
  const base = greedy(toks, width, opts)
  if (base.length < 2) return base
  let lo = 0
  let hi = width
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2
    if (greedy(toks, mid, opts).length <= base.length) hi = mid
    else lo = mid
  }
  return greedy(toks, hi, opts)
}

// Balanced wrap capped at `max` lines; the last line is ellipsised if text remains.
function clampLines(text, width, opts, max) {
  const str = String(text ?? '').trim()
  if (!str) return []
  const lines = greedy(tokens(str, width, opts), width, opts)
  if (lines.length <= max) return balance(str, width, opts)
  const kept = lines.slice(0, max)
  kept[max - 1] = truncate(`${kept[max - 1]} ${lines.slice(max).join(' ')}`, width, opts)
  return kept
}

// The README places the "About" section header (same headline as about.title)
// right above this card. Repeating it verbatim reads as a bug, so when the two
// match, the card becomes a profile card: the name is the headline and the
// handle + location become the eyebrow. Otherwise about.title is used as is.
function headings() {
  const name = profile.name || profile.login || ''
  const sectionTitle = (sections ?? []).find((s) => s.id === 'about')?.title
  const handle = profile.handle || profile.login
  const where = [handle ? `@${handle}` : '', profile.location].filter(Boolean)
  if (about.title && about.title !== sectionTitle) return { kicker: [name], headline: about.title }
  return { kicker: where.length ? where : [name], headline: name || about.title || '' }
}

const EYEBROW = { family: 'mono', size: 12, weight: 400, tracking: 0.08 }

// Mono uppercase eyebrow; " · " separators are drawn as a muted slash.
function kickerText(x, y, parts, maxW) {
  const segs = parts.map((p) => String(p).toUpperCase())
  const plain = segs.join(' / ')
  if (segs.length < 2 || measure(plain, EYEBROW) > maxW) {
    return eyebrow(x, y, truncate(plain, maxW, EYEBROW), { anchor: 'middle', fill: color.textTertiary })
  }
  const content = segs
    .map((s, k) => (k ? `<tspan fill="${color.textMuted}"> / </tspan>` : '') + esc(s))
    .join('')
  return txt(x, y, plain, { ...EYEBROW, anchor: 'middle', fill: color.textTertiary, content })
}

function render() {
  const rows = (about.rows ?? []).filter(Boolean)
  const { kicker, headline } = headings()
  const cardX = PAD
  const cardY = PAD
  const cardW = W - PAD * 2
  const contentX = cardX + CARD_PAD
  const contentW = cardW - CARD_PAD * 2
  const colW = (contentW - COL_GAP) / 2
  const textW = colW - ROW_PAD * 2 - TILE - TILE_GAP

  // vertical rhythm
  const orbCy = cardY + 38 + ORB_R
  const nameY = orbCy + ORB_R + 42
  const headY = nameY + 38
  const introLines = clampLines(about.intro, 600, INTRO, 3)
  const introY = headY + 32
  const introLH = 24
  const gridY = introY + Math.max(0, introLines.length - 1) * introLH + 34

  const wrapped = rows.map((r) => clampLines(r.text, textW, TEXT, 2))
  const maxLines = Math.max(1, ...wrapped.map((l) => l.length))
  const rowH = rowHeight(maxLines)
  const rowCount = Math.ceil(rows.length / 2)
  const gridH = rowCount ? rowCount * rowH + (rowCount - 1) * ROW_GAP : 0
  const cardH = gridY - cardY + gridH + CARD_PAD
  const height = cardY + cardH + PAD

  const doc = createDoc({
    width: W,
    height,
    title: `About ${profile.name || profile.login || 'me'}`,
    desc: [
      profile.name && `${profile.name}${profile.login ? ` (@${profile.login})` : ''}.`,
      about.title,
      about.intro,
      ...rows.map((r) => [r.title, r.text].filter(Boolean).join(': ')),
    ]
      .filter(Boolean)
      .join(' '),
  })

  const cx = W / 2
  const cardBottom = cardY + cardH

  // amber top light: broad glow from card(), plus a tighter core and a lit edge
  const core = radialGradient(doc, 'about-core', [
    [0, color.amber, 0.32],
    [0.5, color.amber, 0.08],
    [1, color.amber, 0],
  ])
  const edge = linearGradient(
    doc,
    'about-edge',
    [
      [0, color.amber, 0],
      [0.5, '#ffd27a', 0.9],
      [1, color.amber, 0],
    ],
    { units: 'userSpaceOnUse', x1: cx - 220, y1: 0, x2: cx + 220, y2: 0 },
  )
  const clip = doc.def(
    'about-card-clip',
    h('clipPath', { id: 'about-card-clip' }, h('rect', { x: cardX, y: cardY, width: cardW, height: cardH, rx: 16 })),
  )

  const grid = rows.map((item, i) => {
    const col = i % 2
    const r = Math.floor(i / 2)
    return row(doc, item, {
      x: contentX + col * (colW + COL_GAP),
      y: gridY + r * (rowH + ROW_GAP),
      w: colW,
      rowH,
      lines: wrapped[i],
    })
  })

  // Vercel grid scaffolding around the card
  const gx1 = cardX + 0.5
  const gx2 = cardX + cardW - 0.5
  const gy1 = cardY + 0.5
  const gy2 = cardBottom - 0.5
  const scaffold = [
    guide(gx1, 0, gx1, height, { dash: '2 4', opacity: 0.9 }),
    guide(gx2, 0, gx2, height, { dash: '2 4', opacity: 0.9 }),
    guide(0, gy1, W, gy1, { dash: '2 4', opacity: 0.9 }),
    guide(0, gy2, W, gy2, { dash: '2 4', opacity: 0.9 }),
  ]
  const crosses = [
    [gx1, gy1],
    [gx2, gy1],
    [gx1, gy2],
    [gx2, gy2],
  ].map(([x, y]) => crosshair(x, y, { stroke: color.textMuted }))

  return doc.render(
    panel(doc),
    scaffold,
    card(doc, { x: cardX, y: cardY, w: cardW, h: cardH, r: 16, glow: { color: color.amber, opacity: 0.13, height: 170 } }),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      dotField(doc, cardX, cardY, cardW, 300),
      h('ellipse', { cx, cy: cardY, rx: 300, ry: 150, fill: `url(#${core})` }),
    ),
    h('path', { d: `M${cx - 220} ${cardY + 0.5}H${cx + 220}`, stroke: `url(#${edge})`, 'stroke-width': 1 }),
    crosses,
    avatar(doc, cx, orbCy),
    kickerText(cx, nameY, kicker, contentW),
    txt(cx, headY, truncate(headline, contentW, HEAD), { ...HEAD, anchor: 'middle', fill: color.text }),
    introLines.map((line, k) =>
      txt(cx, introY + k * introLH, line, { ...INTRO, anchor: 'middle', fill: color.textSecondary }),
    ),
    grid,
  )
}

export default {
  name: 'about',
  render() {
    return [{ path: 'assets/about.svg', svg: render() }]
  },
}
