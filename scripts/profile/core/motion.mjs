// Shared motion kit (DESIGN.md §2.1 rule 6, "Motion policy v2"): the ambient and
// signature animations every panel draws from. Pure functions → SVG markup.
//
//   const sky = starfield(doc, { x: 0, y: 0, w: 860, h: 400, count: 120, seed: 7, flares: 3 })
//   const net = constellation(doc, { x: 32, y: 80, w: 796, h: 260, nodes: 22, seed: 3, pulses: 5 })
//   net.markup / net.nodes / net.edges           // geometry is reusable by the caller
//   borderBeam(doc, { x: 32, y: 32, w: 240, h: 120, r: 12 })
//
// Contract
// - Deterministic: every position, size, colour and phase comes from rng(seed)
//   (mulberry32). Same input → byte-identical markup. No Math.random / Date.now.
// - Keyframes and classes are registered once per document through doc.css();
//   all names are prefixed `mk-`. Durations and phases go inline
//   (style="animation-duration:…;animation-delay:…").
// - Only opacity, transform and stroke-dashoffset animate.
// - The resting state (animation:none — reduced motion, or a renderer that
//   doesn't animate) is complete: stars, particles and nodes sit at their base
//   opacity; beams and pulses rest at a visible position; only the shine band
//   rests off-canvas (it is pure decoration).
// - Phases are negative animation-delays ("−1.6s" = already 1.6s into the
//   loop at load), so nothing waits to start and loops never sync up.
//   `delay` params are that phase, in seconds (a string is used verbatim).

import { h } from './svg.mjs'

// Palettes. AI accent = AI / hero / leadership visuals only (DESIGN.md rule 5).
export const AI = { blue: '#52a8ff', cyan: '#47c9e5', violet: '#a78bfa' }
export const STAR = { white: '#ffffff', pale: '#cfe3ff', blue: '#9cc7ff', amber: '#ffd27a' }

// ── PRNG ────────────────────────────────────────────────────────────────────
/**
 * Seeded PRNG (mulberry32). rng(7)() → [0, 1). Strings are hashed (FNV-1a).
 * Helpers on the returned function: .range(a, b), .int(a, b) (inclusive), .pick(list), .chance(p).
 */
export function rng(seed = 1) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed))
  const next = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.range = (lo, hi) => lo + (hi - lo) * next()
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next())
  next.pick = (list) => list[Math.floor(next() * list.length)]
  next.chance = (p) => next() < p
  return next
}

function hash(s) {
  let x = 0x811c9dc5
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193)
  return x >>> 0
}

/** Phase for item i of n spread over one period: stagger(2, 4, 6) → '-3s'. */
export function stagger(i, n, period) {
  if (!n || !period) return '0s'
  const v = r2((period * (((i % n) + n) % n)) / n)
  return v ? `-${v}s` : '0s'
}

// ── shared CSS ──────────────────────────────────────────────────────────────
const TWINKLE = {
  a: { period: 3.4, frames: '0%,100%{opacity:1}50%{opacity:.3}' },
  b: { period: 5.8, frames: '0%,58%,100%{opacity:1}78%{opacity:.18}' },
  c: { period: 8.6, frames: '0%,100%{opacity:1}22%{opacity:.4}46%{opacity:.95}70%{opacity:.22}' },
}

function twinkleCss(doc) {
  doc.css(
    Object.entries(TWINKLE)
      .map(([k, v]) => `@keyframes mk-tw-${k}{${v.frames}}.mk-tw-${k}{animation:mk-tw-${k} ${v.period}s ease-in-out infinite}`)
      .join('\n'),
  )
}

function style(duration, delay, extra = '') {
  const parts = []
  if (duration !== undefined && duration !== null) parts.push(`animation-duration:${r2(duration)}s`)
  const d = phase(delay)
  if (d && d !== '0s') parts.push(`animation-delay:${d}`)
  if (extra) parts.push(extra)
  return parts.length ? parts.join(';') : null
}

function phase(delay) {
  if (delay === undefined || delay === null || delay === 0) return null
  if (typeof delay === 'string') return delay
  return `${r2(-Math.abs(delay))}s`
}

// ── starfield ───────────────────────────────────────────────────────────────
/**
 * Deep-space stars: tiny circles (r 0.4–1.6), mostly white / pale blue, a few amber.
 *   starfield(doc, { x, y, w, h, count = 90, seed = 1, flares = 0, colors, twinkle = 0.6, avoid, opacity = 1 })
 * - colors: weighted list [[colour, weight], …] (default ≈ 62% white, 30% pale blue, 8% amber).
 * - twinkle: share of stars that twinkle (true = 0.6, false = 0). Twinkling stars are
 *   bucketed into 3 variants (3.4 / 5.8 / 8.6 s) × 4 phases, one animated <g> per bucket
 *   (≤ 12 animated elements however many stars).
 * - flares: N 4-point flare stars (thin tapered cross + soft halo) breathing slowly
 *   (scale + opacity, 6–10 s). Kept off the outer 10% of the box.
 * - avoid: [{ x, y, w, h }] rects kept free of stars (e.g. text blocks).
 * - opacity: global multiplier on every star's base opacity.
 * No nebula: components add their own gradients.
 */
export function starfield(doc, { x = 0, y = 0, w, h: height, count = 90, seed = 1, flares = 0, colors, twinkle = 0.6, avoid = [], opacity = 1 } = {}) {
  const rand = rng(`stars:${seed}`)
  const palette = colors ?? [
    [STAR.white, 62],
    [STAR.pale, 30],
    [STAR.amber, 8],
  ]
  const share = twinkle === true ? 0.6 : twinkle === false ? 0 : Number(twinkle) || 0
  if (share > 0) twinkleCss(doc)
  const variants = Object.keys(TWINKLE)
  const buckets = new Map() // key → circles[]
  const still = []
  let placed = 0
  for (let tries = 0; placed < count && tries < count * 8; tries++) {
    const cx = x + rand() * w
    const cy = y + rand() * height
    const u = rand()
    const r = 0.4 + 1.2 * u ** 2.4 // mostly tiny, a few bright
    const fill = weighted(rand, palette)
    const base = Math.min(1, (0.32 + 0.6 * u + rand() * 0.12) * opacity)
    const tw = rand() < share
    const v = rand.int(0, variants.length - 1)
    const p = rand.int(0, 3)
    if (inside(cx, cy, avoid, 4)) continue
    placed++
    const star = h('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), fill: fill === STAR.white ? null : fill, 'fill-opacity': r2(base) })
    if (tw) {
      const key = `${variants[v]}${p}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(star)
    } else still.push(star)
  }
  const groups = [h('g', { fill: STAR.white }, still)]
  for (const [key, stars] of [...buckets.entries()].sort()) {
    const v = key[0]
    const p = Number(key.slice(1))
    const period = TWINKLE[v].period
    groups.push(h('g', { fill: STAR.white, class: `mk-tw-${v}`, style: style(null, r2((period * (p + 0.5)) / 4)) }, stars))
  }
  // flares
  if (flares > 0) {
    flareDefs(doc)
    doc.css(`@keyframes mk-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.7);opacity:.5}}
.mk-breathe{transform-box:fill-box;transform-origin:center;animation:mk-breathe 8s ease-in-out infinite}`)
    const fr = rng(`flares:${seed}`)
    for (let i = 0, tries = 0; i < flares && tries < flares * 20; tries++) {
      const fx = x + w * fr.range(0.1, 0.9)
      const fy = y + height * fr.range(0.1, 0.9)
      const s = fr.range(0.8, 1.35)
      const dur = fr.range(6, 10)
      const ph = fr.range(0, dur)
      if (inside(fx, fy, avoid, 14)) continue
      i++
      groups.push(
        h(
          'g',
          { transform: `translate(${r2(fx)} ${r2(fy)})`, opacity: opacity < 1 ? r2(opacity) : null },
          h('g', { class: 'mk-breathe', style: style(dur, ph) }, h('use', { href: '#mk-flare', transform: `scale(${r2(s)})` })),
        ),
      )
    }
  }
  return h('g', { class: 'mk-stars' }, groups)
}

// One 4-point flare (centred on 0,0, ~±11px): soft halo, two tapered rays, bright core.
function flareDefs(doc) {
  doc.def(
    'mk-flare-halo',
    h(
      'radialGradient',
      { id: 'mk-flare-halo' },
      h('stop', { offset: 0, 'stop-color': STAR.pale, 'stop-opacity': 0.55 }),
      h('stop', { offset: 0.35, 'stop-color': STAR.pale, 'stop-opacity': 0.14 }),
      h('stop', { offset: 1, 'stop-color': STAR.pale, 'stop-opacity': 0 }),
    ),
  )
  doc.def(
    'mk-flare-ray',
    h(
      'radialGradient',
      { id: 'mk-flare-ray' },
      h('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 }),
      h('stop', { offset: 0.45, 'stop-color': '#fff', 'stop-opacity': 0.45 }),
      h('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }),
    ),
  )
  doc.def(
    'mk-flare',
    h(
      'g',
      { id: 'mk-flare' },
      h('circle', { r: 8, fill: 'url(#mk-flare-halo)' }),
      h('path', { d: 'M-11 0L0-.7L11 0L0 .7Z', fill: 'url(#mk-flare-ray)' }),
      h('path', { d: 'M0-11L.7 0L0 11L-.7 0Z', fill: 'url(#mk-flare-ray)' }),
      h('circle', { r: 1.1, fill: '#fff' }),
    ),
  )
}

// ── particles ───────────────────────────────────────────────────────────────
/**
 * Small drifting dots.
 *   particles(doc, { x, y, w, h, count = 24, seed = 1, direction = 'drift' | 'up', colors, sizes = [0.6, 1.6], opacity = 0.85 up · 0.7 drift, duration, avoid })
 * - 'drift': each dot wanders a few px on one of 3 closed paths (9–15 s) and breathes.
 * - 'up': each dot rises (35–80% of h) and fades in/out, like sparks over a glow.
 * - colors: list of colours (picked uniformly) — default white / pale blue.
 * - duration: base loop length in s (default 12 drift / 9 up); each dot varies ±30%.
 * Rest state: every dot visible at its base position and opacity.
 */
export function particles(doc, { x = 0, y = 0, w, h: height, count = 24, seed = 1, direction = 'drift', colors, sizes = [0.6, 1.6], opacity, duration, avoid = [] } = {}) {
  const rand = rng(`particles:${direction}:${seed}`)
  const palette = colors ?? [STAR.white, STAR.pale]
  const out = []
  const up = direction === 'up'
  const alpha = opacity ?? (up ? 0.85 : 0.7)
  const rises = up ? [0.35, 0.55, 0.8].map((f) => Math.max(8, Math.round(height * f))) : []
  if (up) {
    doc.css(
      rises
        .map(
          (d) =>
            `@keyframes mk-rise-${d}{0%{transform:translateY(0);opacity:0}18%{opacity:1}72%{opacity:.85}100%{transform:translateY(-${d}px);opacity:0}}.mk-rise-${d}{animation:mk-rise-${d} 9s cubic-bezier(.3,0,.7,1) infinite}`,
        )
        .join('\n'),
    )
  } else {
    doc.css(`@keyframes mk-drift-a{0%,100%{transform:translate(0,0);opacity:1}25%{transform:translate(6px,-4px)}50%{transform:translate(2px,-9px);opacity:.45}75%{transform:translate(-5px,-3px)}}
@keyframes mk-drift-b{0%,100%{transform:translate(0,0);opacity:.9}33%{transform:translate(-7px,3px);opacity:.4}66%{transform:translate(4px,6px);opacity:1}}
@keyframes mk-drift-c{0%,100%{transform:translate(0,0);opacity:1}50%{transform:translate(8px,5px);opacity:.35}}
.mk-drift-a{animation:mk-drift-a 12s ease-in-out infinite}.mk-drift-b{animation:mk-drift-b 12s ease-in-out infinite}.mk-drift-c{animation:mk-drift-c 12s ease-in-out infinite}`)
  }
  const base = duration ?? (up ? 9 : 12)
  for (let i = 0, tries = 0; i < count && tries < count * 8; tries++) {
    const r = rand.range(sizes[0], sizes[1])
    const fill = rand.pick(palette)
    const dur = base * rand.range(0.7, 1.3)
    const ph = rand.range(0, dur)
    const op = alpha * rand.range(0.55, 1)
    let cls
    let cx
    let cy
    if (up) {
      const d = rand.pick(rises)
      cls = `mk-rise-${d}`
      cx = x + rand() * w
      cy = y + height - rand() * Math.max(0, height - d) * 0.6 // start low enough to rise inside the box
    } else {
      cls = `mk-drift-${rand.pick(['a', 'b', 'c'])}`
      cx = x + 8 + rand() * Math.max(0, w - 16)
      cy = y + 8 + rand() * Math.max(0, height - 16)
    }
    if (inside(cx, cy, avoid, 6)) continue
    i++
    out.push(h('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), fill, 'fill-opacity': r2(op), class: cls, style: style(dur, ph) }))
  }
  return h('g', { class: 'mk-particles' }, out)
}

// ── constellation ───────────────────────────────────────────────────────────
/**
 * Agent-network constellation: nodes scattered in a box, each joined to its k nearest
 * neighbours (deduplicated), thin low-opacity edges, twinkling nodes, and `pulses`
 * edges carrying a bright dash that travels along them.
 *   constellation(doc, { x, y, w, h, nodes = 18, seed = 1, k = 2, pulses = 4, avoid,
 *                        color = '#ededed', edgeOpacity = 0.16, nodeR = [1.4, 2.6],
 *                        pulseColors = [AI.blue, AI.cyan, AI.violet], pulseDuration = 4.5 })
 *   → { markup, nodes: [{ x, y, r }], edges: [[i, j], …] }
 * Edges are one <path>; node twinkle is bucketed (≤ 9 animated groups); each pulse is
 * one animated <path> (+ a faint wide twin for glow).
 */
export function constellation(doc, { x = 0, y = 0, w, h: height, nodes: n = 18, seed = 1, k = 2, pulses = 4, avoid = [], color = '#ededed', edgeOpacity = 0.16, nodeR = [1.4, 2.6], pulseColors = [AI.blue, AI.cyan, AI.violet], pulseDuration = 4.5 } = {}) {
  const rand = rng(`constellation:${seed}`)
  const minD = Math.sqrt((w * height) / Math.max(1, n)) * 0.55
  const pts = []
  for (let tries = 0; pts.length < n && tries < n * 60; tries++) {
    const px = x + rand() * w
    const py = y + rand() * height
    if (inside(px, py, avoid, 8)) continue
    const relax = tries > n * 30 ? 0.6 : 1
    if (pts.some((p) => (p.x - px) ** 2 + (p.y - py) ** 2 < (minD * relax) ** 2)) continue
    pts.push({ x: r2(px), y: r2(py), r: r2(rand.range(nodeR[0], nodeR[1])) })
  }
  // k nearest neighbours, deduplicated
  const seen = new Set()
  const edges = []
  pts.forEach((p, i) => {
    pts
      .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d || a.j - b.j)
      .slice(0, k)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`
        if (seen.has(key)) return
        seen.add(key)
        edges.push(i < j ? [i, j] : [j, i])
      })
  })
  const parts = []
  if (edges.length) {
    parts.push(
      h('path', {
        d: edges.map(([i, j]) => `M${pts[i].x} ${pts[i].y}L${pts[j].x} ${pts[j].y}`).join(''),
        stroke: color,
        'stroke-opacity': edgeOpacity,
        'stroke-width': 1,
        class: 'mk-edges',
      }),
    )
  }
  // pulses: spread over the edge list, longest edges first so the dash has room to read
  const order = edges
    .map((e, idx) => ({ idx, len: Math.hypot(pts[e[0]].x - pts[e[1]].x, pts[e[0]].y - pts[e[1]].y) }))
    .sort((a, b) => b.len - a.len || a.idx - b.idx)
  const pr = rng(`constellation-pulses:${seed}`)
  order.slice(0, Math.min(pulses, edges.length)).forEach(({ idx }, i) => {
    const [a, b] = edges[idx]
    const flip = pr() < 0.5
    const p0 = flip ? pts[b] : pts[a]
    const p1 = flip ? pts[a] : pts[b]
    const dur = pulseDuration * pr.range(0.8, 1.25)
    parts.push(
      pulseAlong(doc, {
        d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}`,
        color: pulseColors[i % pulseColors.length],
        duration: dur,
        delay: r2((dur * (i + pr())) / Math.max(1, pulses)),
        length: 18,
        width: 1.5,
        rest: 0.35,
      }),
    )
  })
  // nodes: halo + core, twinkle bucketed by variant × phase
  twinkleCss(doc)
  const buckets = new Map()
  pts.forEach((p) => {
    const v = rand.pick(['a', 'b', 'c'])
    const ph = rand.int(0, 2)
    const key = `${v}${ph}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(
      h('circle', { cx: p.x, cy: p.y, r: r2(p.r * 2.6), 'fill-opacity': 0.08 }),
      h('circle', { cx: p.x, cy: p.y, r: p.r, 'fill-opacity': 0.9 }),
    )
  })
  for (const [key, list] of [...buckets.entries()].sort()) {
    const v = key[0]
    const ph = Number(key.slice(1))
    parts.push(h('g', { fill: color, class: `mk-tw-${v}`, style: style(null, r2((TWINKLE[v].period * (ph + 0.5)) / 3)) }, list))
  }
  return { markup: h('g', { class: 'mk-constellation' }, parts), nodes: pts, edges }
}

// ── pulseAlong ──────────────────────────────────────────────────────────────
/**
 * A bright dash travelling along any path `d` (data packet on a wire).
 *   pulseAlong(doc, { d, color = AI.blue, duration = 4, delay = 0, length = 12, width = 1.5, glow = true, rest = 0 })
 * length: dash length as % of the path (pathLength = 100). rest: idle share of each loop
 * (0–0.8) after the dash leaves the path. glow: a 3× wider, faint twin under the dash.
 * Rest state (no animation): the dash sits 40% along the path.
 */
export function pulseAlong(doc, { d, color = AI.blue, duration = 4, delay = 0, length = 12, width = 1.5, glow = true, rest = 0, opacity = 1 } = {}) {
  if (!d) return ''
  const L = Math.max(1, Math.min(60, Math.round(length)))
  const idle = Math.round(Math.max(0, Math.min(0.8, rest)) * 100)
  const name = `mk-pulse-${L}-${idle}`
  doc.css(
    `@keyframes ${name}{0%{stroke-dashoffset:${L + 2}}${100 - idle}%,100%{stroke-dashoffset:-102}}.${name}{animation:${name} 4s cubic-bezier(.45,0,.55,1) infinite}`,
  )
  const common = {
    d,
    pathLength: 100,
    stroke: color,
    'stroke-dasharray': `${L} ${100 + L}`,
    'stroke-dashoffset': -40,
    'stroke-linecap': 'round',
    fill: 'none',
    class: name,
    style: style(duration, delay),
  }
  return [
    glow ? h('path', { ...common, 'stroke-width': r2(width * 3), 'stroke-opacity': r2(0.22 * opacity) }) : '',
    h('path', { ...common, 'stroke-width': width, 'stroke-opacity': opacity < 1 ? r2(opacity) : null }),
  ].join('')
}

// ── borderBeam ──────────────────────────────────────────────────────────────
/**
 * A short bright segment travelling around a rounded rect (Vercel/Magic UI "border beam"):
 * a dim tail, a bright head at its front, and a wide faint twin for the glow (no filters:
 * blurring an animated stroke repaints the whole SVG every frame).
 *   borderBeam(doc, { x, y, w, h, r = 12, color = AI.blue, duration = 8, length = 80, delay = 0, width = 1.5, opacity = 1 })
 * length: segment length in ‰ of the perimeter (pathLength = 1000). Clockwise from the
 * top-left corner. Rest state: the segment sits on the top edge.
 */
export function borderBeam(doc, { x = 0, y = 0, w, h: height, r = 12, color = AI.blue, duration = 8, length = 80, delay = 0, width = 1.5, opacity = 1 } = {}) {
  doc.css('@keyframes mk-beam{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}.mk-beam{animation:mk-beam 8s linear infinite}')
  const L = Math.max(10, Math.min(500, Math.round(length)))
  const head = Math.max(6, Math.round(L * 0.35))
  const d = roundedRectPath(x + 0.5, y + 0.5, w - 1, height - 1, r)
  const restOffset = 1000 - 60 // segment rests just past the top-left corner
  const common = { d, pathLength: 1000, fill: 'none', stroke: color, 'stroke-dashoffset': restOffset, class: 'mk-beam', style: style(duration, delay) }
  return h(
    'g',
    { class: 'mk-beam-group' },
    h('path', { ...common, 'stroke-width': r2(width * 3), 'stroke-opacity': r2(0.16 * opacity), 'stroke-dasharray': `${L} ${1000 - L}` }),
    h('path', { ...common, 'stroke-width': width, 'stroke-opacity': r2(0.45 * opacity), 'stroke-dasharray': `${L} ${1000 - L}` }),
    h('path', { ...common, stroke: '#fff', 'stroke-width': width, 'stroke-opacity': r2(0.9 * opacity), 'stroke-dasharray': `0 ${L - head} ${head} ${1000 - L}` }),
  )
}

// Rounded rect as a path starting after the top-left corner, clockwise.
function roundedRectPath(x, y, w, hh, r) {
  const rr = Math.max(0, Math.min(r, w / 2, hh / 2))
  const R = r2(rr)
  return [
    `M${r2(x + rr)} ${r2(y)}`,
    `H${r2(x + w - rr)}`,
    rr ? `A${R} ${R} 0 0 1 ${r2(x + w)} ${r2(y + rr)}` : '',
    `V${r2(y + hh - rr)}`,
    rr ? `A${R} ${R} 0 0 1 ${r2(x + w - rr)} ${r2(y + hh)}` : '',
    `H${r2(x + rr)}`,
    rr ? `A${R} ${R} 0 0 1 ${r2(x)} ${r2(y + hh - rr)}` : '',
    `V${r2(y + rr)}`,
    rr ? `A${R} ${R} 0 0 1 ${r2(x + rr)} ${r2(y)}` : '',
    'Z',
  ].join('')
}

// ── shineSweep ──────────────────────────────────────────────────────────────
/**
 * Diagonal light band crossing a rounded rect, clipped to it (card sheen).
 *   shineSweep(doc, { x, y, w, h, r = 12, duration = 9, delay = 0, angle = 20, opacity = 0.08, color = '#fff', band })
 * The band crosses during the first 45% of the loop and then waits off-canvas
 * (so the sweep reads as an occasional glint). Rest state: off-canvas (invisible).
 */
export function shineSweep(doc, { x = 0, y = 0, w, h: height, r = 12, duration = 9, delay = 0, angle = 20, opacity = 0.08, color = '#fff', band } = {}) {
  const bw = Math.round(band ?? Math.max(48, Math.min(160, w * 0.22)))
  const tan = Math.tan((angle * Math.PI) / 180)
  const travel = Math.round(w + bw + height * tan + 2)
  const gid = doc.def(
    `mk-shine-${color.replace('#', '')}-${Math.round(opacity * 1000)}`,
    h(
      'linearGradient',
      { id: `mk-shine-${color.replace('#', '')}-${Math.round(opacity * 1000)}` },
      h('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0 }),
      h('stop', { offset: 0.5, 'stop-color': color, 'stop-opacity': r2(opacity) }),
      h('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }),
    ),
  )
  const clip = doc.uid('mk-clip-')
  doc.def(clip, h('clipPath', { id: clip }, h('rect', { x, y, width: w, height, rx: r })))
  doc.css(`@keyframes mk-shine-${travel}{0%{transform:translateX(0)}45%,100%{transform:translateX(${travel}px)}}.mk-shine-${travel}{animation:mk-shine-${travel} 9s cubic-bezier(.4,0,.2,1) infinite}`)
  return h(
    'g',
    { 'clip-path': `url(#${clip})` },
    h(
      'g',
      { transform: `translate(${r2(x - bw - 1)} ${r2(y)}) skewX(${r2(-angle)})` },
      h('rect', { x: 0, y: 0, width: bw, height, fill: `url(#${gid})`, class: `mk-shine-${travel}`, style: style(duration, delay) }),
    ),
  )
}

// ── orbit ───────────────────────────────────────────────────────────────────
/**
 * Dots circling (cx, cy) on a ring of radius r, rotating rigidly.
 *   orbit(doc, { cx, cy, r, count = 3, duration = 24, seed = 1, dot = { r: 2, fill: AI.blue }, ring = true, reverse = false, delay = 0 })
 * Rotation uses transform-box:view-box + transform-origin in px, i.e. (cx, cy) in the
 * element's own user space — works inside translated parents too. dot.fill may be a
 * list (cycled). ring: faint dashed track (stroke #2e2e2e) under the dots.
 */
export function orbit(doc, { cx, cy, r, count = 3, duration = 24, seed = 1, dot = {}, ring = true, reverse = false, delay = 0 } = {}) {
  doc.css(`@keyframes mk-orbit{to{transform:rotate(360deg)}}@keyframes mk-orbit-r{to{transform:rotate(-360deg)}}
.mk-orbit{transform-box:view-box;animation:mk-orbit 24s linear infinite}.mk-orbit-r{transform-box:view-box;animation:mk-orbit-r 24s linear infinite}`)
  const rand = rng(`orbit:${seed}`)
  const fills = Array.isArray(dot.fill) ? dot.fill : [dot.fill ?? AI.blue]
  const dr = dot.r ?? 2
  const start = rand() * 360
  const dots = []
  for (let i = 0; i < count; i++) {
    const a = ((start + (360 * i) / count + rand.range(-12, 12)) * Math.PI) / 180
    const px = cx + r * Math.cos(a)
    const py = cy + r * Math.sin(a)
    const fill = fills[i % fills.length]
    dots.push(
      h('circle', { cx: r2(px), cy: r2(py), r: r2(dr * 2.8), fill, 'fill-opacity': 0.14 }),
      h('circle', { cx: r2(px), cy: r2(py), r: r2(dr), fill }),
    )
  }
  return [
    ring ? h('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), stroke: '#2e2e2e', 'stroke-dasharray': '2 4', fill: 'none' }) : '',
    h('g', { class: reverse ? 'mk-orbit-r' : 'mk-orbit', style: style(duration, delay, `transform-origin:${r2(cx)}px ${r2(cy)}px`) }, dots),
  ].join('')
}

// ── helpers ─────────────────────────────────────────────────────────────────
function weighted(rand, list) {
  const total = list.reduce((s, [, wt]) => s + wt, 0)
  let t = rand() * total
  for (const [value, wt] of list) {
    t -= wt
    if (t < 0) return value
  }
  return list[list.length - 1][0]
}

function inside(px, py, rects, margin = 0) {
  if (!Array.isArray(rects)) return false
  return rects.some((q) => q && px >= q.x - margin && px <= q.x + q.w + margin && py >= q.y - margin && py <= q.y + q.h + margin)
}

function r2(v) {
  return Math.round(v * 100) / 100
}
