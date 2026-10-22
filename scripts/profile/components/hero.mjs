// Hero: the first thing on the profile. A black Vercel-style stage with grid
// guides, a dot-matrix "RunyShark" wordmark (Aceternity pixelated-canvas look)
// over drifting procedural clouds (Aceternity cloud-shader look), a typed
// terminal line and a Vercel-style stat strip fed by the metrics model.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { certifications, profile } from '../content.mjs'
import { int } from '../core/format.mjs'
import { crosshair, guide, linearGradient, pill, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor')
const wordmark = JSON.parse(fs.readFileSync(path.join(vendor, 'wordmark.json'), 'utf8'))

// ── Layout ────────────────────────────────────────────────────────────────
const W = 860
const H = 540
const GUIDE_L = 32 // vertical grid guides sit on the panel padding
const GUIDE_R = W - 32
const INSET = 24 // content inset from the guides
const BAR = 64 // top bar height (rule at y = BAR)
const STRIP = 436 // stat strip top rule
const CX = W / 2

// Static copy the content model does not carry.
const COPY = {
  locale: 'MX · UTC−6',
  years: { value: '7+', label: 'Years shipping' },
  repos: 'Repositories',
  contributions: 'Contributions',
  certs: 'Certifications',
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
function clouds(doc) {
  const drift = 300
  // One fractal-noise layer. R drives density (alpha), G shifts the tint between
  // a cool silver-blue and a faint lavender warmth.
  doc.def(
    'hero-cloud',
    h(
      'filter',
      {
        id: 'hero-cloud',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        filterUnits: 'objectBoundingBox',
        'color-interpolation-filters': 'sRGB',
      },
      h('feTurbulence', {
        type: 'fractalNoise',
        baseFrequency: '0.0022 0.0065',
        numOctaves: 5,
        seed: 11,
        stitchTiles: 'stitch',
      }),
      h('feColorMatrix', {
        type: 'matrix',
        values: ['0 0.55 0 0 0.36', '0 0.1 0 0 0.58', '0 0.15 0 0 0.86', '3.4 0 0 0 -1.56'].join(' '),
      }),
    ),
  )
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
      [0.3, '#000', 0.4],
      [0.6, '#000', 0.55],
      [1, '#000', 0.5],
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
  return h(
    'g',
    { mask: 'url(#hero-cloud-mask)', opacity: 0.5 },
    h(
      'g',
      { class: 'hero-drift' },
      h('rect', { width: W + drift, height: H, fill: '#000', filter: 'url(#hero-cloud)' }),
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
  // Sweep: a narrow cool→warm light band that crosses the word, then rests.
  const sweep = h(
    'linearGradient',
    // base transform = the animation's first value: a static render parks the band off the word
    { id: 'hero-wm-sweep', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 240, y2: 70, gradientTransform: `translate(${box.x - 300} 0)` },
    [
      [0, '#8fb4ff', 0],
      [0.3, '#9dbcff', 0.6],
      [0.47, '#ffffff', 1],
      [0.53, '#ffffff', 1],
      [0.7, '#ffc996', 0.6],
      [1, '#ffc996', 0],
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

function terminal(doc, y) {
  const opts = { family: 'mono', size: 14, weight: 400 }
  const cw = measure('M', opts)
  const prompt = '~ $'
  const lines = profile.taglines?.length ? profile.taglines : [profile.status]
  const maxChars = Math.max(...lines.map((l) => [...l].length))
  const boxH = 40
  const padX = 16
  const promptW = measure(`${prompt} `, opts)
  const boxW = Math.round(padX * 2 + promptW + maxChars * cw + cw + 6)
  const boxX = Math.round(CX - boxW / 2)
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
function stats(data) {
  const user = data?.user ?? {}
  const split = num(user.publicRepos) !== null ? user.publicRepos + (num(user.privateRepos) ?? 0) : null
  const repos = num(user.totalRepos) ?? split
  const contrib = num(data?.contributions?.allTime)
  // Same total as certifications.svg ("45+ certificates"): Udemy + DevTalles.
  const certs = Math.max(0, num(certifications?.udemyCount) ?? 0) + Math.max(0, num(certifications?.devtallesCount) ?? 0)
  return [
    COPY.years,
    { value: repos !== null && repos > 0 ? int(repos) : '—', label: COPY.repos, live: repos !== null && repos > 0 },
    { value: plus(contrib) ?? '—', label: COPY.contributions, live: plus(contrib) !== null },
    { value: certs > 0 ? `${Math.floor(certs)}+` : '—', label: COPY.certs },
  ]
}

function statStrip(data) {
  const items = stats(data)
  const cellW = (GUIDE_R - GUIDE_L) / items.length
  const numOpts = { size: 26, weight: 600, tracking: -0.03 }
  const labelOpts = { size: 12, weight: 400 }
  const top = STRIP
  const out = []
  items.forEach((item, i) => {
    const x = GUIDE_L + i * cellW
    if (i > 0) out.push(guide(r2(x) + 0.5, top, r2(x) + 0.5, H, { stroke: color.border }))
    const tx = r2(x + INSET)
    const maxW = cellW - INSET * 2
    out.push(
      txt(tx, top + 50, truncate(item.value, maxW, numOpts), {
        ...numOpts,
        fill: item.value === '—' ? color.textMuted : color.text,
        attrs: { style: 'font-variant-numeric:tabular-nums' },
      }),
      txt(tx, top + 74, truncate(item.label, maxW, labelOpts), { ...labelOpts, fill: color.textTertiary }),
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

// ── Compose ───────────────────────────────────────────────────────────────
function rolesLine(y) {
  const opts = { size: 16, weight: 500, tracking: -0.01 }
  const roles = profile.roles ?? []
  const content = roles.map((r, i) => (i ? `<tspan fill="${color.textMuted}"> · </tspan>` : '') + esc(r)).join('')
  return txt(CX, y, roles.join(' · '), { ...opts, fill: color.textSecondary, anchor: 'middle', content })
}

// Mono uppercase name, flanked by two short fading rules.
function nameEyebrow(doc, y) {
  const opts = { family: 'mono', size: 12, weight: 400, tracking: 0.14 }
  const text = String(profile.name ?? profile.login).toUpperCase()
  // letter-spacing trails the last glyph: measure without it for true centring.
  const w = measure(text, opts) - opts.tracking * opts.size
  const gap = 14
  const len = 44
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
    txt(r2(CX - w / 2), y, text, { ...opts, fill: color.textTertiary }),
  ].join('')
}

function describe(data) {
  const known = stats(data).filter((x) => x.value !== '—')
  const lines = (profile.taglines ?? []).map((l) => l.replace(/[.\s]+$/, '')).join(' / ')
  return [
    `${profile.login} — ${profile.name}.`,
    `${(profile.roles ?? []).join(', ')}.`,
    `Status: ${profile.status}. Based in ${profile.location} (UTC−6).`,
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

  const eyebrow = nameEyebrow(doc, eyebrowY)

  return doc.render(
    panel(doc),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      clouds(doc),
      glows(doc, box),
      ledField(doc, box),
      grid(),
      seam(doc),
      topBar(doc),
      eyebrow,
      dotWordmark(doc, box),
      rolesLine(rolesY),
      terminal(doc, termY),
      statStrip(data),
    ),
    panel(doc, { fill: 'none' }),
  )
}

export default {
  name: 'hero',
  render({ data } = {}) {
    return [{ path: 'assets/hero.svg', svg: render(data ?? {}) }]
  },
}
