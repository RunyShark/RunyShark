// Hero: the first thing on the profile. A black Vercel-style stage with grid
// guides, a dot-matrix "RunyShark" wordmark (Aceternity pixelated-canvas look)
// over drifting procedural clouds (Aceternity cloud-shader look) and an AI
// "neural constellation" (agent nodes, data pulses, starfield, rising sparks),
// a typed terminal line and a Vercel-style stat strip: the owner's claims
// (years, engineers led, agents in parallel) plus metrics (commits, repos).
//
// Performance (the README animates ~20 SVGs at once, and an <img> SVG is
// re-rasterised whole on every frame): no filter is evaluated per frame. The
// clouds are fractal noise baked at build time into a small PNG (deterministic),
// glows are pre-blurred radial gradients, and the network is dimmed by a static
// gradient overlay rather than a mask over animated content.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { profile } from '../content.mjs'
import { int } from '../core/format.mjs'
import { crosshair, guide, linearGradient, pill, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'
import { AI, STAR, constellation, particles, rng, stagger, starfield } from '../core/motion.mjs'
import { NUMERIC, TYPE as SCALE } from './shared/panel.mjs'

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor')
const wordmark = JSON.parse(fs.readFileSync(path.join(vendor, 'wordmark.json'), 'utf8'))

// ── Layout ────────────────────────────────────────────────────────────────
const W = 860
const H = 552 // stat strip = 116px: 40px hero stats with 32px air above, ~28px below
const GUIDE_L = 32 // vertical grid guides sit on the panel padding
const GUIDE_R = W - 32
const INSET = 24 // content inset from the guides
const BAR = 64 // top bar height (rule at y = BAR)
const STRIP = 436 // stat strip top rule
const CX = W / 2

// Static copy the content model does not carry.
const COPY = {
  locale: 'MX · UTC−6',
  title: 'Principal Engineer',
  years: 'Years shipping',
  engineers: 'Engineers led',
  agents: 'Agents in parallel',
  commits: 'Commits',
  contributions: 'Contributions',
  repos: 'Repositories',
}

// ── Deterministic pseudo-randomness ───────────────────────────────────────
function hash(a, b = 0, salt = 0) {
  let x = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(salt + 1, 362437)) | 0
  x = Math.imul(x ^ (x >>> 15), 2246822519)
  x = Math.imul(x ^ (x >>> 13), 3266489917)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const r2 = (v) => Math.round(v * 100) / 100
const r4 = (v) => Math.round(v * 10000) / 10000
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// 65370 → "65K+", 1234 → "1.2K+", 420 → "420+"
function plus(n) {
  if (num(n) === null || n <= 0) return null
  if (n >= 1e6) return `${Math.floor(n / 1e5) / 10}M+`
  if (n >= 1e4) return `${Math.floor(n / 1e3)}K+`
  if (n >= 1e3) return `${Math.floor(n / 1e2) / 10}K+`
  return `${Math.floor(n)}+`
}

// ── Background: clouds, glows, LED field ─────────────────────────────────
// Cloud texture, baked once per build: two fractal (fBm) Perlin noise fields over
// the (W + drift) × H strip, sampled every CLOUD_CELL px. Field R drives density
// (alpha), field G shifts the tint between a cool silver-blue and a faint lavender
// warmth — the same mapping the old feTurbulence + feColorMatrix used, but paid
// for at build time instead of on every animation frame. → PNG data URI.
const CLOUD_CELL = 3

function perlin(seed) {
  const rand = rng(`hero-cloud:${seed}`)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = [...p, ...p]
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a, b, t) => a + (b - a) * t
  const grad = (ix, iy, dx, dy) => {
    const g = G[perm[perm[ix & 255] + (iy & 255)] & 7]
    return g[0] * dx + g[1] * dy
  }
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = fade(xf)
    const v = fade(yf)
    return lerp(
      lerp(grad(xi, yi, xf, yf), grad(xi + 1, yi, xf - 1, yf), u),
      lerp(grad(xi, yi + 1, xf, yf - 1), grad(xi + 1, yi + 1, xf - 1, yf - 1), u),
      v,
    )
  }
}

// fractalNoise: Σ noise(f·2^o) / 2^o, mapped to [0, 1]
function fbm(noise, x, y, fx, fy, octaves = 5) {
  let sum = 0
  for (let o = 0, amp = 1, f = 1; o < octaves; o++, amp /= 2, f *= 2) sum += noise(x * fx * f + o * 17.3, y * fy * f + o * 9.1) * amp
  return (sum + 1) / 2
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  let c = 0xffffffff
  for (const b of body) c = CRC[(c ^ b) & 255] ^ (c >>> 8)
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, body.length + 4)
  return out
}

// RGBA (non-premultiplied) → PNG, "Sub" row filter, max deflate. Deterministic.
function encodePng(w, hgt, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(hgt, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * hgt)
  for (let y = 0; y < hgt; y++) {
    const row = y * (stride + 1)
    raw[row] = 1
    for (let x = 0; x < stride; x++) raw[row + 1 + x] = (rgba[y * stride + x] - (x >= 4 ? rgba[y * stride + x - 4] : 0)) & 255
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function cloudTexture(width, height) {
  const iw = Math.ceil(width / CLOUD_CELL) + 1
  const ih = Math.ceil(height / CLOUD_CELL) + 1
  const density = perlin(11)
  const tint = perlin(29)
  const px = new Uint8Array(iw * ih * 4)
  const q = (v) => Math.round(255 * Math.min(1, Math.max(0, v))) & 0xfc // 6-bit colour: smaller PNG, no visible banding
  for (let j = 0; j < ih; j++) {
    for (let i = 0; i < iw; i++) {
      const x = i * CLOUD_CELL
      const y = j * CLOUD_CELL
      const a = Math.round(255 * Math.min(1, Math.max(0, 3.4 * fbm(density, x, y, 0.0022, 0.0065) - 1.56))) & 0xfe
      if (!a) continue // fully transparent texel: leave RGB at 0 (compresses to nothing)
      const g = fbm(tint, x, y, 0.0022, 0.0065)
      const k = (j * iw + i) * 4
      px[k] = q(0.55 * g + 0.36)
      px[k + 1] = q(0.1 * g + 0.58)
      px[k + 2] = q(0.15 * g + 0.86)
      px[k + 3] = a
    }
  }
  return { href: `data:image/png;base64,${encodePng(iw, ih, px).toString('base64')}`, w: iw * CLOUD_CELL, h: ih * CLOUD_CELL }
}

function clouds(doc) {
  const drift = 300
  // Clouds live at the edges and along the bottom; the wordmark keeps clean black.
  radialGradient(
    doc,
    'hero-cm-edge',
    [
      [0, '#000'],
      [0.5, '#000'],
      [0.85, '#3a3a3a'],
      [1, '#777'],
    ],
    {
      units: 'userSpaceOnUse',
      cx: CX,
      cy: 236,
      r: 470,
      transform: `translate(${CX} 236) scale(1 0.62) translate(${-CX} -236)`,
    },
  )
  linearGradient(
    doc,
    'hero-cm-floor',
    [
      [0, '#fff', 0],
      [0.45, '#fff', 0.55],
      [0.62, '#fff', 0.9],
      [0.75, '#fff', 0.42],
      [1, '#fff', 0.12],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: 280, x2: 0, y2: H },
  )
  linearGradient(
    doc,
    'hero-cm-top',
    [
      [0, '#000', 1],
      [0.45, '#000', 0.85],
      [1, '#000', 0],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 150 },
  )
  // Thin the clouds under the stat strip so the #878787 labels keep their contrast;
  // the band still peaks on the strip rule, so the mood stays.
  linearGradient(
    doc,
    'hero-cm-strip',
    [
      [0, '#000', 0],
      [0.3, '#000', 0.55],
      [0.6, '#000', 0.72],
      [1, '#000', 0.66],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: STRIP - 16, x2: 0, y2: H },
  )
  doc.def(
    'hero-cloud-mask',
    h(
      'mask',
      { id: 'hero-cloud-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      h('rect', { width: W, height: H, fill: 'url(#hero-cm-edge)' }),
      h('rect', { y: 280, width: W, height: H - 280, fill: 'url(#hero-cm-floor)' }),
      // keep the top bar clean: fade the clouds out above the first rule
      h('rect', { width: W, height: 150, fill: 'url(#hero-cm-top)' }),
      h('rect', { y: STRIP - 16, width: W, height: H - STRIP + 16, fill: 'url(#hero-cm-strip)' }),
    ),
  )
  doc.css(`@keyframes hero-drift{from{transform:translateX(0)}to{transform:translateX(-${drift}px)}}
.hero-drift{animation:hero-drift 72s ease-in-out infinite alternate}`)
  const tex = cloudTexture(W + drift, H)
  return h(
    'g',
    { mask: 'url(#hero-cloud-mask)', opacity: 0.38 },
    h(
      'g',
      { class: 'hero-drift' },
      h('image', { href: tex.href, width: tex.w, height: tex.h, preserveAspectRatio: 'none' }),
    ),
  )
}

function glows(doc, wmBox) {
  const cy = wmBox.y + wmBox.h * 0.45
  const core = radialGradient(doc, 'hero-glow-core', [
    [0, '#c9d6ff', 0.11],
    [0.5, '#8ea6ff', 0.035],
    [1, '#8ea6ff', 0],
  ])
  const warm = radialGradient(doc, 'hero-glow-warm', [
    [0, color.amber, 0.3],
    [0.22, color.amber, 0.12],
    [0.6, color.amber, 0.025],
    [1, color.amber, 0],
  ])
  return [
    h('ellipse', { cx: CX, cy, rx: 420, ry: 150, fill: `url(#${core})` }),
    h('ellipse', { cx: CX, cy: BAR, rx: 300, ry: 96, fill: `url(#${warm})` }),
  ].join('')
}

// Lit seam: light catching the top rule, like the edge highlight on Vercel cards.
function seam(doc) {
  const g = linearGradient(
    doc,
    'hero-seam',
    [
      [0, color.amber, 0],
      [0.5, '#ffd9a0', 0.75],
      [1, color.amber, 0],
    ],
    { units: 'userSpaceOnUse', x1: CX - 210, y1: 0, x2: CX + 210, y2: 0 },
  )
  return h('path', { d: `M${CX - 210} ${BAR + 0.5}H${CX + 210}`, stroke: `url(#${g})`, 'stroke-width': 1 })
}

// Unlit LEDs: a faint dot field on the wordmark's grid, fading out radially.
function ledField(doc, wmBox) {
  const { cell } = wordmark
  doc.def(
    'hero-led',
    h(
      'pattern',
      { id: 'hero-led', patternUnits: 'userSpaceOnUse', x: wmBox.x, y: wmBox.y, width: cell, height: cell },
      h('circle', { cx: cell / 2, cy: cell / 2, r: 0.75, fill: '#fff' }),
    ),
  )
  radialGradient(
    doc,
    'hero-led-fade',
    [
      [0, '#fff', 0.9],
      [0.55, '#fff', 0.35],
      [1, '#fff', 0],
    ],
    {
      units: 'userSpaceOnUse',
      cx: CX,
      cy: wmBox.y + wmBox.h / 2,
      r: 400,
      transform: `translate(${CX} ${wmBox.y + wmBox.h / 2}) scale(1 0.42) translate(${-CX} ${-(wmBox.y + wmBox.h / 2)})`,
    },
  )
  doc.def(
    'hero-led-mask',
    h(
      'mask',
      { id: 'hero-led-mask', maskUnits: 'userSpaceOnUse', x: 0, y: BAR, width: W, height: STRIP - BAR },
      h('rect', { y: BAR, width: W, height: STRIP - BAR, fill: 'url(#hero-led-fade)' }),
    ),
  )
  return h('rect', {
    x: GUIDE_L + 1,
    y: BAR + 1,
    width: GUIDE_R - GUIDE_L - 2,
    height: STRIP - BAR - 2,
    fill: 'url(#hero-led)',
    mask: 'url(#hero-led-mask)',
    opacity: 0.11,
  })
}

// ── Wordmark ──────────────────────────────────────────────────────────────
function wordmarkBox() {
  const { cell, width, height, dots } = wordmark
  // Optical centring on the inked columns rather than the padded grid.
  let minC = Infinity
  let maxC = -Infinity
  for (const [c, , v] of dots) {
    if (v > 0.3) {
      minC = Math.min(minC, c)
      maxC = Math.max(maxC, c)
    }
  }
  const inkCentre = ((minC + maxC + 1) / 2) * cell
  return { x: Math.round(CX - inkCentre), y: 156, w: width, h: height }
}

function dotWordmark(doc, box) {
  const { cell, dots } = wordmark
  const maxR = cell / 2 - 0.65
  const circles = []
  for (const [c, r, cov] of dots) {
    const solid = cov >= 0.985
    if (!solid && hash(c, r, 1) < 0.065) continue // dropout: pixelated-canvas texture
    const rad = Math.min(maxR, Math.max(0.6, maxR * Math.sqrt(cov)))
    const roll = hash(c, r, 2)
    const cls = roll < 0.09 ? `hero-tw${1 + Math.floor(hash(c, r, 3) * 3)}` : null
    circles.push(
      h('circle', {
        cx: box.x + c * cell + cell / 2,
        cy: box.y + r * cell + cell / 2,
        r: r2(rad),
        class: cls,
        opacity: cov < 0.25 ? 0.7 : null,
      }),
    )
  }
  // Drawn once in place (so the twinkle classes animate as normal elements) and
  // re-used, unfilled, by the sweep layer: the band costs no extra bytes.
  const dotsGroup = h('g', { id: 'hero-wm' }, circles)

  // Base: Vercel-style headline metal — bright top, cooling to gray at the foot.
  linearGradient(
    doc,
    'hero-wm-base',
    [
      [0, '#ffffff'],
      [0.45, '#eaeaea'],
      [0.8, '#a8aab2'],
      [1, '#787d8e'],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: box.y + cell, x2: 0, y2: box.y + cell * 17 },
  )
  // Sweep: a narrow white light band that crosses the word, then rests. Kept
  // achromatic (only a whisper of cool lead / warm tail): a coloured band read as
  // a selection tint on the wordmark, not as light on metal.
  const sweep = h(
    'linearGradient',
    // base transform = the animation's first value: a static render parks the band off the word
    { id: 'hero-wm-sweep', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 240, y2: 70, gradientTransform: `translate(${box.x - 300} 0)` },
    [
      [0, '#eef3ff', 0],
      [0.32, '#eef3ff', 0.3],
      [0.47, '#ffffff', 0.95],
      [0.53, '#ffffff', 0.95],
      [0.68, '#fff6ec', 0.3],
      [1, '#fff6ec', 0],
    ].map(([offset, c, o]) => h('stop', { offset, 'stop-color': c, 'stop-opacity': o })),
    h('animateTransform', {
      attributeName: 'gradientTransform',
      type: 'translate',
      values: `${box.x - 300} 0;${box.x + box.w + 60} 0;${box.x + box.w + 60} 0`,
      keyTimes: '0;0.5;1',
      calcMode: 'spline',
      keySplines: '0.45 0 0.25 1;0 0 1 1',
      dur: '10s',
      repeatCount: 'indefinite',
    }),
  )
  doc.def('hero-wm-sweep', sweep)

  doc.css(`@keyframes hero-tw{0%,58%,100%{opacity:1}79%{opacity:.38}}
.hero-tw1{animation:hero-tw 3.6s ease-in-out infinite}
.hero-tw2{animation:hero-tw 4.8s ease-in-out -1.7s infinite}
.hero-tw3{animation:hero-tw 6.2s ease-in-out -3.9s infinite}`)

  return [
    h('g', { fill: 'url(#hero-wm-base)' }, dotsGroup),
    h('use', { href: '#hero-wm', fill: 'url(#hero-wm-sweep)' }),
  ].join('')
}

// ── Top bar ───────────────────────────────────────────────────────────────
// Tiny halftone orb (the about-card avatar motif) used as the brand mark.
function orbMark(doc, cx, cy, R = 10) {
  const g = linearGradient(
    doc,
    'hero-orb',
    [
      [0, '#ff7ab6'],
      [0.55, '#c26bff'],
      [1, '#6a5cff'],
    ],
    { units: 'userSpaceOnUse', x1: cx - R, y1: cy - R, x2: cx + R, y2: cy + R },
  )
  const pitch = 2.5
  const lx = cx - R * 0.45
  const ly = cy - R * 0.5
  const dots = []
  for (let gy = -R; gy <= R; gy += pitch) {
    for (let gx = -R; gx <= R; gx += pitch) {
      const x = cx + gx + pitch / 2
      const y = cy + gy + pitch / 2
      const d = Math.hypot(x - cx, y - cy)
      if (d > R - 0.4) continue
      const light = Math.max(0, 1 - Math.hypot(x - lx, y - ly) / (R * 1.75))
      const rim = Math.max(0, 1 - (R - d) / 2.2) // soften the silhouette
      const rad = Math.max(0.28, 1.2 * light ** 0.8 - rim * 0.3)
      dots.push(h('circle', { cx: r2(x), cy: r2(y), r: r2(rad) }))
    }
  }
  const halo = radialGradient(doc, 'hero-orb-halo', [
    [0, '#ff4d8d', 0.28],
    [1, '#ff4d8d', 0],
  ])
  const bx = cx + R * 0.68
  const by = cy + R * 0.68
  return [
    h('circle', { cx, cy, r: R * 1.9, fill: `url(#${halo})` }),
    h('g', { fill: `url(#${g})` }, dots),
    // small amber badge, as on the avatar card
    h('circle', { cx: r2(bx), cy: r2(by), r: 3.4, fill: color.bg }),
    h('circle', { cx: r2(bx), cy: r2(by), r: 2.2, fill: color.amber }),
  ].join('')
}

function topBar(doc) {
  const cy = BAR / 2
  const left = GUIDE_L + INSET
  const right = GUIDE_R - INSET
  const handleOpts = { family: 'mono', size: 13, weight: 400 }
  const status = pill(doc, {
    x: right,
    y: cy - 14,
    text: profile.status,
    dot: color.greenBright,
    align: 'end',
    size: 13,
    weight: 500,
    fill: color.surface,
    stroke: color.borderStrong,
    textFill: color.text,
  })
  const localeOpts = { family: 'mono', size: 12, weight: 400 }
  const localeX = right - status.width - 16
  return [
    orbMark(doc, left + 10, cy),
    txt(left + 30, centerBaseline(cy, handleOpts), profile.handle, { ...handleOpts, fill: color.textSecondary }),
    txt(localeX, centerBaseline(cy, localeOpts), COPY.locale, {
      ...localeOpts,
      fill: color.textTertiary,
      anchor: 'end',
    }),
    status.markup,
  ].join('')
}

// ── Terminal line ─────────────────────────────────────────────────────────
const TYPE = { perChar: 0.045, hold: 1.5, openHold: 4.5, perErase: 0.016, pause: 0.3, blink: 0.5 }

// Builds per-line clip widths (in chars) and caret position/opacity over one
// seamless cycle. The cycle starts with line 0 already typed, so frame 0 (and any
// renderer that ignores SMIL) shows a complete line; that opening hold is long
// (openHold) so a page that is still loading, or a screenshot taken a moment
// after the image decodes, never catches the line half-erased.
function typingTimeline(lines) {
  const events = [] // { t, line, chars, typing }
  let t = 0
  const push = (line, chars, typing) => events.push({ t: r4(t), line, chars, typing })
  const type = (line, n) => {
    for (let c = 1; c <= n; c++) {
      push(line, c, true)
      t += TYPE.perChar
    }
  }
  lines.forEach((text, i) => {
    const n = [...text].length
    if (i > 0) type(i, n) // line 0 opens the cycle already typed
    push(i, n, false) // hold (caret blinks)
    t += i === 0 ? TYPE.openHold : TYPE.hold
    for (let c = n - 1; c >= 0; c--) {
      push(i, c, true) // fast backspace
      t += TYPE.perErase
    }
    push(i, 0, false) // empty prompt
    t += TYPE.pause
  })
  type(0, [...lines[0]].length) // retype line 0: the loop ends where it began
  return { events, dur: r4(t) }
}

const TERM = { opts: { family: 'mono', size: 14, weight: 400 }, prompt: '~ $', boxH: 40, padX: 16 }

function terminalGeom() {
  const { opts, prompt, padX } = TERM
  const cw = measure('M', opts)
  const lines = profile.taglines?.length ? profile.taglines : [profile.status]
  const maxChars = Math.max(...lines.map((l) => [...l].length))
  const promptW = measure(`${prompt} `, opts)
  const boxW = Math.round(padX * 2 + promptW + maxChars * cw + cw + 6)
  return { cw, lines, promptW, boxW, boxX: Math.round(CX - boxW / 2) }
}

function terminal(doc, y) {
  const { opts, prompt, boxH, padX } = TERM
  const { cw, lines, promptW, boxW, boxX } = terminalGeom()
  const textX = boxX + padX + promptW
  const base = centerBaseline(y + boxH / 2, opts)
  const { events, dur } = typingTimeline(lines)
  const kt = (t) => r4(t / dur)

  // Per-line clip rect: width animates in whole characters (stepped like typing).
  const lineEls = lines.map((text, i) => {
    const frames = []
    let last = null
    for (const e of events) {
      const w = e.line === i ? e.chars : 0
      if (w !== last) {
        frames.push([kt(e.t), r2(w * cw)])
        last = w
      }
    }
    if (frames[0][0] !== 0) frames.unshift([0, 0])
    const clipId = `hero-type-${i}`
    doc.def(
      clipId,
      h(
        'clipPath',
        { id: clipId },
        h(
          'rect',
          { x: textX, y: y + 4, width: frames[0][1], height: boxH - 8 },
          h('animate', {
            attributeName: 'width',
            values: frames.map((f) => f[1]).join(';'),
            keyTimes: frames.map((f) => f[0]).join(';'),
            calcMode: 'discrete',
            dur: `${dur}s`,
            repeatCount: 'indefinite',
          }),
        ),
      ),
    )
    return txt(textX, base, text, { ...opts, fill: color.text, attrs: { 'clip-path': `url(#${clipId})` } })
  })

  // Caret: follows the typed text; solid while typing, blinking while idle.
  const caretFrames = []
  let lastX = null
  let lastO = null
  const pushCaret = (t, x, o) => {
    if (x === lastX && o === lastO) return
    caretFrames.push([kt(t), x, o])
    lastX = x
    lastO = o
  }
  for (let k = 0; k < events.length; k++) {
    const e = events[k]
    const next = events[k + 1]?.t ?? dur
    const x = r2(textX + e.chars * cw + 1)
    if (e.typing) {
      pushCaret(e.t, x, 1)
      continue
    }
    // idle: blink until the next event
    for (let tt = e.t, on = true; tt < next - 1e-6; tt = r4(tt + TYPE.blink), on = !on) {
      pushCaret(tt, x, on ? 1 : 0)
    }
  }
  const caret = h(
    'rect',
    { x: caretFrames[0][1], y: base - 12, width: r2(cw - 1.5), height: 15, rx: 1, fill: color.text, opacity: 0.9 },
    h('animate', {
      attributeName: 'x',
      values: caretFrames.map((f) => f[1]).join(';'),
      keyTimes: caretFrames.map((f) => f[0]).join(';'),
      calcMode: 'discrete',
      dur: `${dur}s`,
      repeatCount: 'indefinite',
    }),
    h('animate', {
      attributeName: 'fill-opacity',
      values: caretFrames.map((f) => f[2]).join(';'),
      keyTimes: caretFrames.map((f) => f[0]).join(';'),
      calcMode: 'discrete',
      dur: `${dur}s`,
      repeatCount: 'indefinite',
    }),
  )

  const edge = linearGradient(
    doc,
    'hero-term-edge',
    [
      [0, '#ffffff', 0],
      [0.5, '#ffffff', 0.16],
      [1, '#ffffff', 0],
    ],
    { units: 'userSpaceOnUse', x1: boxX + 12, y1: 0, x2: boxX + boxW - 12, y2: 0 },
  )
  return [
    h('rect', {
      x: boxX + 0.5,
      y: y + 0.5,
      width: boxW - 1,
      height: boxH - 1,
      rx: 10,
      fill: color.surface,
      stroke: color.borderStrong,
    }),
    h('path', { d: `M${boxX + 12} ${y + 0.5}H${boxX + boxW - 12}`, stroke: `url(#${edge})` }),
    txt(boxX + padX, base, prompt, { ...opts, fill: color.textTertiary }),
    lineEls,
    caret,
  ].join('')
}

// ── Stat strip ────────────────────────────────────────────────────────────
// Five equal columns: the owner's claims (content.mjs) then two metrics.
function stats(data) {
  const user = data?.user ?? {}
  const claims = profile.claims ?? {}
  const claim = (v) => (v === undefined || v === null || v === '' ? '—' : String(v))
  const split = num(user.publicRepos) !== null ? user.publicRepos + (num(user.privateRepos) ?? 0) : null
  const repos = num(user.totalRepos) ?? split
  const commits = plus(num(user.totalCommits))
  const contrib = plus(num(data?.contributions?.allTime))
  return [
    { value: claim(claims.yearsShipping), label: COPY.years },
    { value: claim(claims.engineersLed), label: COPY.engineers },
    { value: claim(claims.parallelAgents), label: COPY.agents },
    commits ? { value: commits, label: COPY.commits } : { value: contrib ?? '—', label: COPY.contributions },
    { value: repos !== null && repos > 0 ? int(repos) : '—', label: COPY.repos },
  ]
}

function statStrip(data) {
  const items = stats(data)
  const cellW = (GUIDE_R - GUIDE_L) / items.length
  const numOpts = SCALE.heroStat // 40/600 −0.04em (DESIGN.md rule 3)
  const labelOpts = SCALE.small
  const top = STRIP
  const out = []
  items.forEach((item, i) => {
    const x = GUIDE_L + i * cellW
    if (i > 0) out.push(guide(r2(x) + 0.5, top, r2(x) + 0.5, H, { stroke: color.border }))
    const tx = r2(x + INSET)
    const maxW = cellW - INSET * 2
    out.push(
      txt(tx, top + 60, truncate(item.value, maxW, numOpts), {
        ...numOpts,
        fill: item.value === '—' ? color.textTertiary : color.text,
        attrs: NUMERIC,
      }),
      txt(tx, top + 86, truncate(item.label, maxW, labelOpts), { ...labelOpts, fill: color.textTertiary }),
    )
  })
  return out.join('')
}

// ── Grid guides ───────────────────────────────────────────────────────────
function grid() {
  const xs = [GUIDE_L + 0.5, GUIDE_R - 0.5]
  const ys = [BAR + 0.5, STRIP + 0.5]
  return [
    ...ys.map((y) => guide(0, y, W, y)),
    ...xs.map((x) => guide(x, 0, x, H)),
    ...ys.flatMap((y) => xs.map((x) => crosshair(x, y, { size: 13, stroke: color.textMuted }))),
  ].join('')
}

// ── AI layer: neural constellation, starfield, sparks ─────────────────────
// Ink bounding box of the wordmark (dots with real coverage), in px.
function wordmarkInk(box) {
  const { cell, dots } = wordmark
  let c0 = Infinity
  let c1 = -Infinity
  let r0 = Infinity
  let r1 = -Infinity
  for (const [c, r, v] of dots) {
    if (v <= 0.3) continue
    c0 = Math.min(c0, c)
    c1 = Math.max(c1, c)
    r0 = Math.min(r0, r)
    r1 = Math.max(r1, r)
  }
  return { x: box.x + c0 * cell, y: box.y + r0 * cell, w: (c1 - c0 + 1) * cell, h: (r1 - r0 + 1) * cell }
}

const pad = (q, px, py = px) => ({ x: q.x - px, y: q.y - py, w: q.w + px * 2, h: q.h + py * 2 })

// Everything here is decoration behind the type: nodes, stars and sparks keep
// out of the `keep` rects (wordmark, eyebrow, roles, terminal), and a soft
// radial mask dims the network toward the centre so edges never compete with text.
function aiLayer(doc, keep, focus) {
  const area = { x: GUIDE_L + 8, y: BAR + 10, w: GUIDE_R - GUIDE_L - 16, h: STRIP - BAR - 26 }
  // The amber seam glow under the top rule stays clear of network nodes (air, like
  // the halo around Vercel's triangle); stars may still sit there.
  const halo = { x: CX - 190, y: BAR, w: 380, h: 40 }

  // Faint AI-accent nebulae low in the frame (OpenAI model-card space).
  const neb = (id, c, o) =>
    radialGradient(doc, id, [
      [0, c, o],
      [0.45, c, o * 0.35],
      [1, c, 0],
    ])
  const nebulae = [
    h('ellipse', { cx: 150, cy: 352, rx: 230, ry: 120, fill: `url(#${neb('hero-neb-v', AI.violet, 0.1)})` }),
    h('ellipse', { cx: 716, cy: 330, rx: 240, ry: 120, fill: `url(#${neb('hero-neb-b', AI.blue, 0.09)})` }),
    h('ellipse', { cx: CX, cy: 410, rx: 300, ry: 70, fill: `url(#${neb('hero-neb-c', AI.cyan, 0.05)})` }),
  ].join('')

  const stars = starfield(doc, { ...area, count: 70, seed: 'hero', flares: 3, twinkle: 0.55, avoid: keep, opacity: 0.6 })

  const net = constellation(doc, {
    ...area,
    nodes: 84,
    seed: 'hero',
    k: 2,
    pulses: 14,
    avoid: [...keep, halo],
    color: '#dfe7ff',
    edgeOpacity: 0.11,
    nodeR: [0.9, 1.8],
    pulseDuration: 5.5,
  })

  // Dimmer: full strength at the frame edges, dimmed behind the type. The network
  // is the first layer on the black stage, so a black radial veil drawn right over
  // it equals a luminance mask — without re-compositing a masked layer of ~100
  // animated nodes and pulses on every frame.
  radialGradient(
    doc,
    'hero-net-veil',
    [
      [0, '#000', 0.83],
      [0.5, '#000', 0.77],
      [0.78, '#000', 0.26],
      [1, '#000', 0],
    ],
    {
      units: 'userSpaceOnUse',
      cx: CX,
      cy: focus,
      r: 440,
      transform: `translate(${CX} ${focus}) scale(1 0.62) translate(${-CX} ${-focus})`,
    },
  )
  const veil = h('rect', { y: BAR, width: W, height: STRIP - BAR, fill: 'url(#hero-net-veil)' })

  const sparks = particles(doc, {
    x: GUIDE_L + 16,
    y: 300,
    w: GUIDE_R - GUIDE_L - 32,
    h: STRIP - 300 - 6,
    count: 16,
    seed: 'hero',
    direction: 'up',
    colors: [AI.blue, AI.cyan, AI.violet, STAR.pale],
    sizes: [0.8, 1.7],
    avoid: keep,
  })

  return { network: [net.markup, hubs(doc, net), veil].join(''), sky: [nebulae, stars, sparks].join('') }
}

// Agent hubs: the best-connected nodes (kept 150px apart), drawn larger in the AI
// accent with a soft halo and a slow sonar ring (scale + opacity only). At rest
// the ring sits as a faint outline, so the hub still reads as a hub.
function hubs(doc, net, count = 6) {
  const degree = net.nodes.map(() => 0)
  for (const [a, b] of net.edges) {
    degree[a]++
    degree[b]++
  }
  const picks = []
  const ranked = net.nodes
    .map((p, i) => ({ ...p, i, d: degree[i] }))
    .sort((a, b) => b.d - a.d || b.r - a.r || a.i - b.i)
  for (const n of ranked) {
    if (picks.length >= count) break
    if (picks.some((q) => Math.hypot(q.x - n.x, q.y - n.y) < 150)) continue
    picks.push(n)
  }
  picks.sort((a, b) => a.x - b.x || a.y - b.y)
  doc.css(`@keyframes hero-sonar{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(3.4);opacity:0}}
.hero-sonar{transform-box:fill-box;transform-origin:center;animation:hero-sonar 4.8s cubic-bezier(0,0,.2,1) infinite}`)
  const tones = [AI.blue, AI.cyan, AI.violet]
  return picks
    .map((n, k) => {
      const c = tones[k % tones.length]
      return [
        h('circle', { cx: n.x, cy: n.y, r: 9, fill: c, 'fill-opacity': 0.12 }),
        h('circle', { cx: n.x, cy: n.y, r: 3, stroke: c, 'stroke-opacity': 0.55, class: 'hero-sonar', style: `animation-delay:${stagger(k, picks.length, 4.8)}` }),
        h('circle', { cx: n.x, cy: n.y, r: 2.2, fill: c }),
        h('circle', { cx: n.x, cy: n.y, r: 0.9, fill: '#fff' }),
      ].join('')
    })
    .join('')
}

// AI seam: light catching the stat-strip rule in the AI accent, mirroring the
// amber seam on the top rule.
function aiSeam(doc) {
  const g = linearGradient(
    doc,
    'hero-ai-seam',
    [
      [0, AI.blue, 0],
      [0.3, AI.blue, 0.55],
      [0.5, AI.cyan, 0.7],
      [0.7, AI.violet, 0.55],
      [1, AI.violet, 0],
    ],
    { units: 'userSpaceOnUse', x1: CX - 260, y1: 0, x2: CX + 260, y2: 0 },
  )
  return h('path', { d: `M${CX - 260} ${STRIP + 0.5}H${CX + 260}`, stroke: `url(#${g})`, 'stroke-width': 1 })
}

// Comet: a soft-ended streak of light gliding along a straight rule (x1 → x2),
// fading in and out over the first half of the loop and resting unseen for the
// second half. It replaces a perimeter border beam, whose fragments clipped at the
// rounded corners and on the side edges read as rendering glitches. One animated
// <g> (transform + opacity only); the glow is a pre-blurred radial gradient, not a
// filter. Rest state (animation:none): hidden — pure decoration.
function comet(doc, { id, x1, x2, y, len = 160, colors, duration = 12, delay = 0, reverse = false, opacity = 1 }) {
  const [tail, mid] = colors
  const stops = [
    [0, tail, 0],
    [0.55, mid, 0.55],
    [0.9, '#ffffff', 1],
    [1, '#ffffff', 0],
  ]
  const line = linearGradient(doc, `${id}-line`, reverse ? stops.map(([o, c, a]) => [r4(1 - o), c, a]).reverse() : stops, {
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 0,
  })
  const glow = radialGradient(doc, `${id}-glow`, [
    [0, mid, 0.42],
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

// ── Compose ───────────────────────────────────────────────────────────────
const ROLES = { size: 16, weight: 500, tracking: -0.01 }

function rolesLine(y) {
  const roles = profile.roles ?? []
  const content = roles.map((r, i) => (i ? `<tspan fill="${color.textTertiary}"> · </tspan>` : '') + esc(r)).join('')
  return txt(CX, y, roles.join(' · '), { ...ROLES, fill: color.textSecondary, anchor: 'middle', content })
}

// Mono uppercase name + title, flanked by two short fading rules.
const EYEBROW = { family: 'mono', size: 12, weight: 400, tracking: 0.14 }
const EB_GAP = 14
const EB_LEN = 44
const eyebrowText = () => `${profile.name ?? profile.login} · ${COPY.title}`.toUpperCase()
// letter-spacing trails the last glyph: measure without it for true centring.
const eyebrowWidth = () => measure(eyebrowText(), EYEBROW) - EYEBROW.tracking * EYEBROW.size

function nameEyebrow(doc, y) {
  const text = eyebrowText()
  const w = eyebrowWidth()
  const gap = EB_GAP
  const len = EB_LEN
  const ly = r2(y - 4) + 0.5
  const l = linearGradient(
    doc,
    'hero-eb-l',
    [
      [0, color.borderHover, 0],
      [1, color.borderHover],
    ],
    { units: 'userSpaceOnUse', x1: CX - w / 2 - gap - len, y1: 0, x2: CX - w / 2 - gap, y2: 0 },
  )
  const r = linearGradient(
    doc,
    'hero-eb-r',
    [
      [0, color.borderHover],
      [1, color.borderHover, 0],
    ],
    { units: 'userSpaceOnUse', x1: CX + w / 2 + gap, y1: 0, x2: CX + w / 2 + gap + len, y2: 0 },
  )
  return [
    h('path', { d: `M${r2(CX - w / 2 - gap - len)} ${ly}H${r2(CX - w / 2 - gap)}`, stroke: `url(#${l})` }),
    h('path', { d: `M${r2(CX + w / 2 + gap)} ${ly}H${r2(CX + w / 2 + gap + len)}`, stroke: `url(#${r})` }),
    txt(r2(CX - w / 2), y, text, { ...EYEBROW, fill: color.textTertiary }),
  ].join('')
}

function describe(data) {
  const known = stats(data).filter((x) => x.value !== '—')
  const lines = (profile.taglines ?? []).map((l) => l.replace(/[.\s]+$/, '')).join(' / ')
  return [
    `${profile.login} — ${profile.name}, ${COPY.title} and AI expert.`,
    `${(profile.roles ?? []).join(', ')}.`,
    `Status: ${profile.status}. Based in ${profile.location} (UTC−6).`,
    'A dot-matrix RunyShark wordmark over drifting clouds and an AI neural constellation: agent nodes linked by faint edges, data pulses travelling between them, a starfield and rising sparks.',
    lines ? `Terminal taglines: ${lines}.` : '',
    known.length ? `Stats: ${known.map((x) => `${x.value} ${x.label.toLowerCase()}`).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function render(data) {
  const doc = createDoc({ width: W, height: H, title: `${profile.login} — ${profile.name}`, desc: describe(data) })
  const clip = panelClip(doc)
  const box = wordmarkBox()

  const eyebrowY = box.y - 22
  const rolesY = box.y + wordmark.cell * 17 + 48
  const termY = rolesY + 28

  // Keep-out rects for the AI layer: every piece of type on the stage.
  const ebW = eyebrowWidth() + 2 * (EB_GAP + EB_LEN)
  const rolesW = measure((profile.roles ?? []).join(' · '), ROLES)
  const term = terminalGeom()
  const keep = [
    pad(wordmarkInk(box), 10, 8),
    pad({ x: CX - ebW / 2, y: eyebrowY - 12, w: ebW, h: 16 }, 8, 6),
    pad({ x: CX - rolesW / 2, y: rolesY - 14, w: rolesW, h: 19 }, 10, 6),
    pad({ x: term.boxX, y: termY, w: term.boxW, h: TERM.boxH }, 10, 8),
  ]

  const eyebrow = nameEyebrow(doc, eyebrowY)
  const ai = aiLayer(doc, keep, box.y + box.h * 0.5)

  // Signature motion: two comets taking turns on the frame's two lit rules — one
  // along the panel's top edge (left → right), then one along the stat-strip seam
  // (right → left), half a loop later. Never two at once, never on a corner.
  const LOOP = 14
  const comets = [
    comet(doc, { id: 'hero-comet-top', x1: 48, x2: W - 48, y: 0.5, len: 180, colors: [AI.blue, AI.cyan], duration: LOOP, delay: 1.5, opacity: 0.9 }),
    comet(doc, { id: 'hero-comet-seam', x1: GUIDE_L + 16, x2: GUIDE_R - 16, y: STRIP + 0.5, len: 150, colors: [AI.violet, AI.cyan], duration: LOOP, delay: 1.5 + LOOP / 2, reverse: true, opacity: 0.8 }),
  ]

  return doc.render(
    panel(doc),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      ai.network,
      clouds(doc),
      glows(doc, box),
      ai.sky,
      ledField(doc, box),
      grid(),
      seam(doc),
      aiSeam(doc),
      comets[1],
      topBar(doc),
      eyebrow,
      dotWordmark(doc, box),
      rolesLine(rolesY),
      terminal(doc, termY),
      statStrip(data),
    ),
    panel(doc, { fill: 'none' }),
    comets[0],
  )
}

export default {
  name: 'hero',
  render({ data } = {}) {
    return [{ path: 'assets/hero.svg', svg: render(data ?? {}) }]
  },
}
