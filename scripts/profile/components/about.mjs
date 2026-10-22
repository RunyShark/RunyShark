// About card — modelled on Vercel's amber-glow dashboard dialog: a halftone
// "pixelated canvas" orb avatar with a small amber badge, a centred headline and
// intro, then the eight highlights as bordered rows (icon tile + title + text)
// in a two-column grid. Static: ignores metrics.
//
// Motion (DESIGN.md rule 6, Motion policy v2): an "AI aura" of two orbit rings
// with AI-accent particles around the orb, drifting AI particles and a few flare
// stars in the glow, two comets of light taking turns along the card's top
// (amber) and bottom (AI violet) edges, a single glint that visits the row cards
// one at a time in a diagonal order, and a faint starfield in the outer panel
// margin. Every layer rests in a complete, readable state.
//
// Performance: no filters anywhere (glows are pre-blurred radial gradients), and
// the comets and glints are one transform/opacity-animated element each.

import { about, profile, sections } from '../content.mjs'
import { glyph, hasGlyph } from '../core/glyphs.mjs'
import { AI, orbit, particles, starfield } from '../core/motion.mjs'
import { card, crosshair, eyebrow, guide, iconTile, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { measure, truncate, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'

const W = layout.width
const PAD = layout.pad // panel → card
const CARD_PAD = 32 // card → content
const ORB_R = 42
const ORB_PITCH = 2.9 // halftone cell size (px)
const COL_GAP = 16 // DESIGN.md: 16px gaps
const ROW_GAP = 16
const ROW_PAD = 16
const TILE = 36
const TILE_GAP = 14
// AI aura: two orbit rings around the orb (radius offsets from ORB_R)
const RING_IN = 12
const RING_OUT = 26
// Row glint: one card at a time. Each glint crosses its card in GLINT_CROSS s,
// the next card starts GLINT_STEP s later; the loop is one full tour.
const GLINT_CROSS = 1.6
const GLINT_STEP = 2.4
// Edge comets: one loop, the bottom comet half a loop after the top one.
const COMET_LOOP = 16

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

function avatar(doc, cx, cy) {
  const bloom = radialGradient(doc, 'orb-bloom', [
    [0, color.pink, 0.26],
    [0.45, color.purple, 0.1],
    [1, color.purple, 0],
  ])
  // AI aura: a cool blue → violet halo wider than the pink bloom
  const aura = radialGradient(doc, 'orb-aura', [
    [0, AI.violet, 0],
    [0.42, AI.violet, 0.1],
    [0.62, AI.blue, 0.07],
    [1, AI.blue, 0],
  ])
  // inner ring: thin AI-accent gradient stroke (blue → cyan → violet)
  const ringIn = linearGradient(
    doc,
    'orb-ring-ai',
    [
      [0, AI.blue, 0.55],
      [0.5, AI.cyan, 0.18],
      [1, AI.violet, 0.5],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 1 },
  )
  doc.css(`@keyframes orb-orbit{to{transform:rotate(360deg)}}
.orb-orbit{transform-box:fill-box;transform-origin:center;animation:orb-orbit 90s linear infinite}`)

  const rIn = ORB_R + RING_IN
  const rOut = ORB_R + RING_OUT

  // badge sits on the orb's rim at 45° (lower right)
  const bR = 12.5
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
  const gs = 15

  return [
    h('circle', { cx, cy, r: ORB_R * 2.9, fill: `url(#${aura})` }),
    h('circle', { cx, cy, r: ORB_R * 2.1, fill: `url(#${bloom})` }),
    // outer ring: faint dotted track, slowly turning, with three AI particles
    h('circle', {
      cx,
      cy,
      r: rOut,
      stroke: '#ffffff',
      'stroke-opacity': 0.12,
      'stroke-dasharray': '1 5',
      'stroke-linecap': 'round',
      class: 'orb-orbit',
    }),
    orbit(doc, {
      cx,
      cy,
      r: rOut,
      count: 3,
      duration: 34,
      seed: 'about-aura-out',
      ring: false,
      reverse: true,
      dot: { r: 1.5, fill: [AI.violet, AI.blue, AI.cyan] },
    }),
    // inner ring: AI gradient hairline with two brighter particles
    h('circle', { cx, cy, r: rIn, stroke: `url(#${ringIn})`, 'stroke-width': 1 }),
    orbit(doc, {
      cx,
      cy,
      r: rIn,
      count: 2,
      duration: 18,
      seed: 'about-aura-in',
      ring: false,
      dot: { r: 1.9, fill: [AI.cyan, AI.blue] },
    }),
    orb(doc, cx, cy, ORB_R),
    // badge: card-coloured cut-out ring, amber disc, dark sparkles glyph (AI)
    h('circle', { cx: r2(bx), cy: r2(by), r: bR + 3, fill: color.surface }),
    h('circle', { cx: r2(bx), cy: r2(by), r: bR, fill: `url(#${badgeFill})` }),
    h('circle', { cx: r2(bx), cy: r2(by), r: bR - 0.5, stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': 1, fill: 'none' }),
    glyph('sparkles', { x: r2(bx - gs / 2), y: r2(by - gs / 2), size: gs, stroke: '#1f1300', strokeWidth: 1.9 }),
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

// Comet: a soft-ended streak of light gliding along a straight edge (x1 → x2, or
// back with `reverse`), fading in and out over the first half of the loop and
// resting unseen for the second half. Replaces perimeter border beams, whose
// fragments wrapping the rounded corners read as rendering glitches. One animated
// <g> (transform + opacity); the glow is a pre-blurred radial gradient.
function comet(doc, { id, x1, x2, y, len = 160, colors, duration = 16, delay = 0, reverse = false, opacity = 1 }) {
  const [tail, mid] = colors
  const stops = [
    [0, tail, 0],
    [0.55, mid, 0.55],
    [0.9, '#ffffff', 1],
    [1, '#ffffff', 0],
  ]
  const line = linearGradient(doc, `${id}-line`, reverse ? stops.map(([o, c, a]) => [r2(1 - o), c, a]).reverse() : stops)
  const glow = radialGradient(doc, `${id}-glow`, [
    [0, mid, 0.4],
    [0.5, mid, 0.12],
    [1, mid, 0],
  ])
  const travel = r2(x2 - x1 - len)
  const start = reverse ? x2 - len : x1
  const headX = reverse ? start + len * 0.12 : start + len * 0.88
  doc.css(`@keyframes ${id}{0%{transform:translateX(0);opacity:0}9%{opacity:1}41%{opacity:1}50%,100%{transform:translateX(${reverse ? -travel : travel}px);opacity:0}}
.${id}{animation:${id} ${duration}s cubic-bezier(.4,0,.6,1) infinite}`)
  return h(
    'g',
    { opacity: 0, class: id, style: delay ? `animation-delay:${r2(-delay)}s` : null },
    h('g', { opacity: opacity < 1 ? opacity : null }, [
      h('ellipse', { cx: r2(headX), cy: y, rx: r2(len * 0.42), ry: 7, fill: `url(#${glow})` }),
      h('rect', { x: r2(start), y: r2(y - 0.5), width: len, height: 1, fill: `url(#${line})` }),
    ]),
  )
}

// Glint: a soft diagonal light band crossing one row card, clipped to it. It
// crosses during `cross` seconds of a `loop`-second cycle and waits off-card the
// rest of the time, so with staggered phases exactly one card glints at a time.
// Rest state: off-card (invisible). One animated rect per card.
function glint(doc, { x, y, w, h: hgt, r = 10, loop, cross, phase, opacity = 0.09, angle = 22, band = 120 }) {
  const gid = linearGradient(doc, 'about-glint', [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', opacity],
    [1, '#ffffff', 0],
  ])
  const clip = doc.uid('about-glint-clip-')
  doc.def(clip, h('clipPath', { id: clip }, h('rect', { x, y, width: w, height: hgt, rx: r })))
  const travel = Math.round(w + band + hgt * Math.tan((angle * Math.PI) / 180) + 2)
  const end = r2((cross / loop) * 100)
  const name = `about-glint-${travel}-${Math.round(end * 10)}`
  doc.css(`@keyframes ${name}{0%{transform:translateX(0)}${end}%,100%{transform:translateX(${travel}px)}}
.${name}{animation:${name} ${loop}s cubic-bezier(.45,0,.25,1) infinite}`)
  return h(
    'g',
    { 'clip-path': `url(#${clip})` },
    h(
      'g',
      { transform: `translate(${r2(x - band - 1)} ${r2(y)}) skewX(${-angle})` },
      h('rect', { width: band, height: hgt, fill: `url(#${gid})`, class: name, style: phase ? `animation-delay:${r2(-phase)}s` : null }),
    ),
  )
}

// Row metrics: cap-top of the title to the descender of the last text line.
const TITLE_CAP = 10
const TITLE_TO_TEXT = 20
const TEXT_LH = 18
const DESCENDER = 3

function rowHeight(lines) {
  return ROW_PAD + TITLE_CAP + TITLE_TO_TEXT + (lines - 1) * TEXT_LH + DESCENDER + ROW_PAD
}

function row(doc, item, { x, y, w, rowH, lines, shine }) {
  const textX = x + ROW_PAD + TILE + TILE_GAP
  const textW = w - (textX - x) - ROW_PAD
  const title = truncate(item.title ?? '', textW, TITLE)
  // centre the text block (and the tile) vertically in the row
  const blockH = TITLE_CAP + (lines.length ? TITLE_TO_TEXT + (lines.length - 1) * TEXT_LH + DESCENDER : 0)
  const titleY = y + (rowH - blockH) / 2 + TITLE_CAP
  const glyphName = hasGlyph(item.glyph) ? item.glyph : null
  return [
    h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: rowH - 1, rx: 10, fill: color.surface, stroke: color.border }),
    // sheen under the content so text and icons stay crisp while it passes
    shine ?? '',
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
  const where = [handle ? `@${handle}` : '', profile.location, profile.roles?.[0]].filter(Boolean)
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
    .map((s, k) => (k ? `<tspan fill="${color.textTertiary}"> / </tspan>` : '') + esc(s))
    .join('')
  return txt(x, y, plain, { ...EYEBROW, anchor: 'middle', fill: color.textTertiary, content })
}

// Vercel two-tone statement: the lead sentence in primary ink, the rest in
// secondary. Lines come from a whitespace wrap, so joining them with single
// spaces rebuilds the text and gives each line's character offset.
function introText(cx, y0, lh, lines, text) {
  const str = String(text ?? '').trim().replace(/\s+/g, ' ')
  const stop = str.search(/[.!?](\s|$)/)
  const lead = stop >= 0 && stop < str.length - 1 ? stop + 1 : 0
  let offset = 0
  return lines.map((line, k) => {
    const cut = Math.max(0, Math.min(line.length, lead - offset))
    offset += line.length + 1
    const head = line.slice(0, cut)
    const tail = line.slice(cut)
    const content = [
      head ? `<tspan fill="${color.text}">${esc(head)}</tspan>` : '',
      tail ? `<tspan fill="${color.textSecondary}">${esc(tail)}</tspan>` : '',
    ].join('')
    return txt(cx, y0 + k * lh, line, { ...INTRO, anchor: 'middle', fill: color.textSecondary, content })
  })
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
  const orbCy = cardY + 30 + ORB_R + RING_OUT
  const nameY = orbCy + ORB_R + RING_OUT + 32
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

  // Glint tour: one card at a time, in reading order zig-zagging down the grid
  // (row 1 left → right, row 2 right → left, …) so the light seems to travel.
  const tour = rows.map((_, i) => {
    const r = Math.floor(i / 2)
    const col = i % 2
    return r * 2 + (r % 2 ? 1 - col : col)
  })
  const glintLoop = r2(Math.max(1, rows.length) * GLINT_STEP)
  const grid = rows.map((item, i) => {
    const col = i % 2
    const r = Math.floor(i / 2)
    const x = contentX + col * (colW + COL_GAP)
    const y = gridY + r * (rowH + ROW_GAP)
    const shine = glint(doc, {
      x,
      y,
      w: colW,
      h: rowH,
      loop: glintLoop,
      cross: GLINT_CROSS,
      phase: r2((glintLoop - tour[i] * GLINT_STEP) % glintLoop),
    })
    return row(doc, item, { x, y, w: colW, rowH, lines: wrapped[i], shine })
  })

  // ambient layers
  const outerStars = starfield(doc, {
    x: 0,
    y: 0,
    w: W,
    h: height,
    count: 46,
    seed: 'about-outer',
    twinkle: 0.65,
    opacity: 0.75,
    avoid: [{ x: cardX - 3, y: cardY - 3, w: cardW + 6, h: cardH + 6 }],
  })
  // text blocks keep a generous star-free margin so no star reads as punctuation
  const textBox = (y, hgt, w) => ({ x: cx - w / 2 - 56, y: y - 6, w: w + 112, h: hgt + 12 })
  const auraBox = { x: cx - ORB_R - RING_OUT - 10, y: orbCy - ORB_R - RING_OUT - 10, w: (ORB_R + RING_OUT + 10) * 2, h: (ORB_R + RING_OUT + 10) * 2 }
  const textAvoid = [
    auraBox,
    textBox(nameY - 14, 20, measure(kicker.join(' / ').toUpperCase(), EYEBROW) + 24),
    textBox(headY - 26, 34, measure(headline, HEAD) + 24),
    textBox(introY - 18, (introLines.length - 1) * introLH + 26, 640),
  ]
  const glowTop = cardY + 6
  const glowH = gridY - 20 - glowTop
  const innerStars = starfield(doc, {
    x: cardX + 24,
    y: glowTop,
    w: cardW - 48,
    h: glowH,
    count: 34,
    seed: 'about-inner',
    flares: 3,
    twinkle: 0.7,
    opacity: 0.55,
    avoid: textAvoid,
  })
  const motes = particles(doc, {
    x: cardX + 40,
    y: glowTop + 8,
    w: cardW - 80,
    h: glowH - 16,
    count: 18,
    seed: 'about-motes',
    direction: 'drift',
    colors: [AI.blue, AI.cyan, AI.violet, '#ffffff'],
    sizes: [0.7, 1.6],
    opacity: 0.75,
    avoid: textAvoid,
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

  const pclip = panelClip(doc)
  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${pclip})` }, outerStars),
    scaffold,
    card(doc, { x: cardX, y: cardY, w: cardW, h: cardH, r: 16, glow: { color: color.amber, opacity: 0.13, height: 170 } }),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      dotField(doc, cardX, cardY, cardW, 300),
      h('ellipse', { cx, cy: cardY, rx: 300, ry: 150, fill: `url(#${core})` }),
    ),
    h('path', { d: `M${cx - 220} ${cardY + 0.5}H${cx + 220}`, stroke: `url(#${edge})`, 'stroke-width': 1 }),
    h('g', { 'clip-path': `url(#${clip})` }, innerStars, motes),
    // two comets taking turns on the card's straight edges: amber light along the
    // top (left → right), then AI violet along the bottom (right → left) half a
    // loop later. Never on a corner, never both at once.
    comet(doc, { id: 'about-comet-top', x1: cardX + 32, x2: cardX + cardW - 32, y: cardY + 0.5, len: 180, colors: [color.amber, '#ffd27a'], duration: COMET_LOOP, delay: 2, opacity: 0.9 }),
    comet(doc, { id: 'about-comet-bottom', x1: cardX + 32, x2: cardX + cardW - 32, y: cardBottom - 0.5, len: 160, colors: [AI.violet, AI.violet], duration: COMET_LOOP, delay: 2 + COMET_LOOP / 2, reverse: true, opacity: 0.75 }),
    crosses,
    avatar(doc, cx, orbCy),
    kickerText(cx, nameY, kicker, contentW),
    txt(cx, headY, truncate(headline, contentW, HEAD), { ...HEAD, anchor: 'middle', fill: color.text }),
    introText(cx, introY, introLH, introLines, about.intro),
    grid,
  )
}

export default {
  name: 'about',
  render() {
    return [{ path: 'assets/about.svg', svg: render() }]
  },
}
