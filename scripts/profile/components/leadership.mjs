// Leadership — the engineering organization as a living graph. Left: an org
// constellation on a deep-space stage — one glowing Principal node broadcasting
// to six clusters of ten engineers (60 person-dots = leadership.people; clusters
// are deliberately unlabeled). Right: the headcount KPI with a 60-dot headcount
// strip, then three delivery rows read from metrics (pull requests + merge rate,
// commits, consecutive weeks shipping). Bottom: the four leadership.pillars as
// 2×2 cards with frosted AI-accent glyph tiles.
//
// Motion (DESIGN.md rule 6, Motion policy v2): starfield + drifting particles on
// the stage (ambient); data pulses broadcasting from the Principal along every
// link, twinkling engineers, broadcast ripples and an orbit round the Principal,
// and a filter-free comet beam round the stage (signatures). The resting state is
// complete: every dot, link, label and number is visible with animation:none.

import { leadership, profile } from '../content.mjs'
import { dateInZone, int, percent, plural } from '../core/format.mjs'
import { glyph, hasGlyph } from '../core/glyphs.mjs'
import { AI, orbit, particles, pulseAlong, rng, shineSweep, starfield } from '../core/motion.mjs'
import { card, crosshair, eyebrow, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, h, panel, panelClip } from '../core/svg.mjs'
import { capHeight, measure, truncate, txt, wrap } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'
import { INK, NUMERIC, PANEL, TYPE, freshness, freshnessPill, panelFooter, panelHeader } from './shared/panel.mjs'

// ── Layout ────────────────────────────────────────────────────────────────
const W = PANEL.width
const PAD = PANEL.pad
const GAP = PANEL.gap
const TOP = PANEL.toolbar + PAD // 96: content starts on the padding grid

const STAGE = { x: PAD, y: TOP, w: 496, h: 248, r: 12 }
const SIDE = { x: STAGE.x + STAGE.w + 24, y: TOP } // right column
SIDE.w = W - PAD - SIDE.x // 284

const PILLAR_TOP = STAGE.y + STAGE.h + 24
const PILLAR_H = 88
const PILLAR_W = (W - PAD * 2 - GAP) / 2 // 390
const PILLARS_BOTTOM = PILLAR_TOP + PILLAR_H * 2 + GAP
const H = PILLARS_BOTTOM + PAD + PANEL.footer

// Org graph
const CLUSTERS = 6
const CLUSTER_R = 23 // radius of one cluster's dot field
const RING_RX = 172
const RING_RY = 74

const ROW_H = 48
const TILE = 36

const LABEL = { size: 13, weight: 500 }
const NOTE = { size: 12, weight: 400 }
const ROW_VALUE = TYPE.secondary // 24/600: secondary numbers on the panel scale
const PILLAR_TITLE = { size: 14, weight: 500 }
const PILLAR_TEXT = { size: 13, weight: 400 }

const COPY = {
  title: 'Engineering organization',
  subtitle: 'Principal Engineer · 60 engineers',
  stageEyebrow: 'Org graph',
  principal: 'Principal',
  legendEngineer: 'Engineer',
  legendPrincipal: 'Principal engineer',
  kpiEyebrow: 'Organization',
  kpiLabel: 'Engineers led',
  kpiNote: 'AI-first engineering org',
  role: 'Principal Engineer',
  source: 'GitHub GraphQL API · incl. private repositories',
}

const r2 = (v) => Math.round(v * 100) / 100
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// ── Data ──────────────────────────────────────────────────────────────────
function model(data) {
  const prs = data?.pullRequests ?? {}
  const user = data?.user ?? {}
  const weekly = data?.contributions?.weeklyStreak?.current ?? {}
  const total = num(prs.total)
  const rate = num(prs.mergeRate) ?? (num(prs.merged) !== null && total ? prs.merged / total : null)
  const commits = num(user.totalCommits)
  const repos = num(user.totalRepos)
  const weeks = num(weekly.weeks)
  const since = dateInZone(weekly.start, 'UTC', { year: true })
  const people = num(leadership.people) ?? num(profile.claims?.engineersLed) ?? 60
  return {
    people,
    rows: [
      {
        glyph: 'gitPullRequest',
        label: 'Pull requests',
        note: rate !== null ? `${percent(rate)} merged` : 'Merge rate unavailable',
        value: total !== null ? int(total) : '—',
        meter: rate,
      },
      {
        glyph: 'gitCommit',
        label: 'Commits',
        note: repos !== null ? `Across ${int(repos)} ${plural(repos, 'repository', 'repositories')}` : 'All time',
        value: commits !== null ? int(commits) : '—',
      },
      {
        glyph: 'flame',
        label: 'Weeks shipping',
        note: since ? `Consecutive, since ${since}` : 'Consecutive weeks',
        value: weeks !== null ? int(weeks) : '—',
      },
    ],
  }
}

// ── Org graph ─────────────────────────────────────────────────────────────
const TW = {
  a: { period: 3.6, frames: '0%,100%{opacity:1}50%{opacity:.35}' },
  b: { period: 5.4, frames: '0%,60%,100%{opacity:1}80%{opacity:.25}' },
  c: { period: 7.8, frames: '0%,100%{opacity:1}30%{opacity:.45}60%{opacity:.9}80%{opacity:.3}' },
}

function orgGraph(doc, people) {
  const cx = STAGE.x + STAGE.w / 2
  const cy = STAGE.y + STAGE.h / 2 + 2
  const rand = rng('leadership:org')
  const per = Math.max(1, Math.round(people / CLUSTERS))
  doc.css(
    Object.entries(TW)
      .map(([k, v]) => `@keyframes ld-tw-${k}{${v.frames}}.ld-tw-${k}{animation:ld-tw-${k} ${v.period}s ease-in-out infinite}`)
      .join('\n'),
  )

  const accents = [AI.blue, AI.cyan, AI.violet]
  const clusters = []
  let placed = 0
  for (let c = 0; c < CLUSTERS; c++) {
    const n = c === CLUSTERS - 1 ? Math.max(0, people - placed) : Math.min(per, people - placed)
    placed += n
    const a = (Math.PI * 2 * c) / CLUSTERS
    const ccx = cx + RING_RX * Math.cos(a)
    const ccy = cy + RING_RY * Math.sin(a)
    const rot = rand() * Math.PI * 2
    const dots = []
    for (let i = 0; i < n; i++) {
      const rr = CLUSTER_R * Math.sqrt((i + 0.5) / n)
      const t = rot + i * 2.39996 // golden angle
      dots.push({
        x: r2(ccx + rr * Math.cos(t) + rand.range(-1.6, 1.6)),
        y: r2(ccy + rr * Math.sin(t) * 0.86 + rand.range(-1.6, 1.6)),
        r: r2(rand.range(1.7, 2.5)),
      })
    }
    clusters.push({ cx: r2(ccx), cy: r2(ccy), dots, accent: accents[c % accents.length] })
  }

  const parts = []

  // cluster glows (one shared gradient per accent)
  for (const cl of clusters) {
    const gid = radialGradient(doc, `ld-cl-${cl.accent.slice(1)}`, [
      [0, cl.accent, 0.2],
      [0.6, cl.accent, 0.05],
      [1, cl.accent, 0],
    ])
    parts.push(h('ellipse', { cx: cl.cx, cy: cl.cy, rx: CLUSTER_R * 2.1, ry: CLUSTER_R * 1.8, fill: `url(#${gid})` }))
    parts.push(h('ellipse', { cx: cl.cx, cy: cl.cy, rx: CLUSTER_R + 9, ry: CLUSTER_R * 0.86 + 9, stroke: '#2e2e2e', 'stroke-dasharray': '2 4' }))
  }

  // links: principal → each cluster's nearest dot (soft curve)
  const links = clusters.map((cl, i) => {
    const near = [...cl.dots].sort((p, q) => (p.x - cx) ** 2 + (p.y - cy) ** 2 - ((q.x - cx) ** 2 + (q.y - cy) ** 2))[0]
    const dx = near.x - cx
    const dy = near.y - cy
    const len = Math.hypot(dx, dy) || 1
    const sx = cx + (dx / len) * 16
    const sy = cy + (dy / len) * 16
    const bend = (i % 2 ? 1 : -1) * 10
    const mx = (sx + near.x) / 2 - (dy / len) * bend
    const my = (sy + near.y) / 2 + (dx / len) * bend
    return { d: `M${r2(sx)} ${r2(sy)}Q${r2(mx)} ${r2(my)} ${near.x} ${near.y}`, accent: cl.accent }
  })
  parts.push(h('path', { d: links.map((l) => l.d).join(''), stroke: '#ededed', 'stroke-opacity': 0.2, 'stroke-width': 1 }))

  // intra-cluster edges: 2 nearest neighbours, deduplicated, one path
  const seg = []
  const chatter = []
  for (const cl of clusters) {
    const seen = new Set()
    let best = null
    cl.dots.forEach((p, i) => {
      cl.dots
        .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 }))
        .filter((e) => e.j !== i)
        .sort((m, n) => m.d - n.d || m.j - n.j)
        .slice(0, 2)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`
          if (seen.has(key)) return
          seen.add(key)
          const q = cl.dots[j]
          seg.push(`M${p.x} ${p.y}L${q.x} ${q.y}`)
          const len = Math.hypot(p.x - q.x, p.y - q.y)
          if (!best || len > best.len) best = { len, d: `M${p.x} ${p.y}L${q.x} ${q.y}` }
        })
    })
    if (best) chatter.push({ d: best.d, accent: cl.accent })
  }
  parts.push(h('path', { d: seg.join(''), stroke: '#ededed', 'stroke-opacity': 0.22, 'stroke-width': 1 }))

  // broadcast pulses (principal → clusters)
  links.forEach((l, i) => {
    parts.push(
      pulseAlong(doc, {
        d: l.d,
        color: l.accent,
        duration: 3.4,
        delay: r2((3.4 * i) / CLUSTERS + 0.3),
        length: 32,
        width: 1.8,
        rest: 0.25,
      }),
    )
  })
  // agent chatter inside each cluster
  chatter.forEach((c, i) => {
    parts.push(pulseAlong(doc, { d: c.d, color: '#ffffff', duration: 3.2, delay: r2(0.7 + i * 1.1), length: 45, width: 1.2, rest: 0.55, opacity: 0.8 }))
  })

  // engineers: halo + core, twinkle bucketed (3 variants × 3 phases ≤ 9 groups)
  const buckets = new Map()
  clusters.forEach((cl) => {
    cl.dots.forEach((p) => {
      const v = rand.pick(['a', 'b', 'c'])
      const ph = rand.int(0, 2)
      const key = `${v}${ph}`
      if (!buckets.has(key)) buckets.set(key, [])
      const tint = rand.chance(0.22) ? cl.accent : null
      buckets.get(key).push(
        h('circle', { cx: p.x, cy: p.y, r: r2(p.r * 2.4), fill: tint, 'fill-opacity': 0.12 }),
        h('circle', { cx: p.x, cy: p.y, r: p.r, fill: tint, 'fill-opacity': 0.95 }),
      )
    })
  })
  for (const [key, list] of [...buckets.entries()].sort()) {
    const v = key[0]
    const ph = Number(key.slice(1))
    const delay = r2((TW[v].period * (ph + 0.5)) / 3)
    parts.push(h('g', { fill: '#ededed', class: `ld-tw-${v}`, style: `animation-delay:-${delay}s` }, list))
  }

  // principal: halo, broadcast ripples, orbit, ring + core
  const halo = radialGradient(doc, 'ld-halo', [
    [0, '#ffffff', 0.5],
    [0.18, AI.blue, 0.35],
    [0.5, AI.violet, 0.1],
    [1, AI.violet, 0],
  ])
  doc.css(`@keyframes ld-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.82);opacity:.7}}
.ld-breathe{transform-box:fill-box;transform-origin:center;animation:ld-breathe 6s ease-in-out infinite}
@keyframes ld-ripple{0%{transform:scale(1);opacity:.9}100%{transform:scale(4.2);opacity:0}}
.ld-ripple{transform-box:fill-box;transform-origin:center;animation:ld-ripple 4.8s cubic-bezier(0,0,.3,1) infinite}`)
  parts.push(h('circle', { cx, cy, r: 58, fill: `url(#${halo})`, class: 'ld-breathe' }))
  parts.push(h('circle', { cx, cy, r: 14, stroke: AI.blue, 'stroke-opacity': 0.55, 'stroke-width': 1.2, class: 'ld-ripple' }))
  parts.push(h('circle', { cx, cy, r: 14, stroke: AI.violet, 'stroke-opacity': 0.45, 'stroke-width': 1.2, class: 'ld-ripple', style: 'animation-delay:-2.4s' }))
  parts.push(particles(doc, { x: cx - 44, y: cy - 70, w: 88, h: 60, count: 8, seed: 'principal', direction: 'up', colors: [AI.blue, AI.cyan, '#ffffff'], sizes: [0.8, 1.5] }))
  parts.push(orbit(doc, { cx, cy, r: 24, count: 3, duration: 16, seed: 'principal', dot: { r: 1.6, fill: [AI.blue, AI.cyan, AI.violet] } }))
  parts.push(h('circle', { cx, cy, r: 12.5, fill: '#0a0a0a', stroke: '#ededed', 'stroke-opacity': 0.7 }))
  parts.push(h('circle', { cx, cy, r: 5, fill: '#ffffff' }))
  // label tag (opaque, so links never run through the text)
  const tagFont = { size: 12, family: 'mono', weight: 400, tracking: 0.08 }
  const tagW = Math.ceil(measure(COPY.principal.toUpperCase(), tagFont) + 16)
  const tagY = cy + 30
  parts.push(h('rect', { x: r2(cx - tagW / 2) + 0.5, y: tagY + 0.5, width: tagW - 1, height: 21, rx: 10.5, fill: '#0a0a0a', stroke: color.borderStrong }))
  parts.push(eyebrow(cx, r2(tagY + 11 + capHeight(tagFont) / 2), COPY.principal, { fill: INK.primary, anchor: 'middle' }))

  return { markup: parts.join(''), center: { x: cx, y: cy }, clusters }
}

function stage(doc, people) {
  const { x, y, w, h: hh, r } = STAGE
  const clip = doc.def('ld-stage-clip', h('clipPath', { id: 'ld-stage-clip' }, h('rect', { x, y, width: w, height: hh, rx: r })))
  const neb = radialGradient(doc, 'ld-nebula', [
    [0, AI.blue, 0.16],
    [0.45, AI.violet, 0.06],
    [1, AI.violet, 0],
  ])
  const graph = orgGraph(doc, people)
  const c = graph.center
  const textAvoid = [
    { x: x + 8, y: y + 8, w: 140, h: 24 },
    { x: x + 8, y: y + hh - 34, w: 260, h: 28 },
  ]
  const avoid = [{ x: c.x - 40, y: c.y - 40, w: 80, h: 96 }, ...textAvoid, ...graph.clusters.map((cl) => ({ x: cl.cx - 34, y: cl.cy - 30, w: 68, h: 60 }))]
  const legendY = y + hh - 20
  return [
    h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: hh - 1, rx: r, fill: '#030303' }),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      h('ellipse', { cx: c.x, cy: c.y, rx: w * 0.55, ry: hh * 0.75, fill: `url(#${neb})` }),
      starfield(doc, { x, y, w, h: hh, count: 110, seed: 'leadership', flares: 3, twinkle: 0.5, opacity: 0.85, avoid }),
      particles(doc, { x, y, w, h: hh, count: 16, seed: 'leadership', direction: 'drift', colors: [AI.blue, AI.cyan, AI.violet, '#cfe3ff'], sizes: [0.8, 1.6], avoid: textAvoid }),
      graph.markup,
    ),
    // stage chrome on top of the art
    h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: hh - 1, rx: r, stroke: color.border }),
    cometBeam(doc, { x, y, w, h: hh, r, color: AI.blue, duration: 14, delay: 3, length: 12, opacity: 0.85 }),
    eyebrow(x + 16, y + 26, COPY.stageEyebrow),
    // legend
    h('circle', { cx: x + 20, cy: legendY - 4, r: 2.2, fill: '#ededed' }),
    txt(x + 30, legendY, `${people} ${plural(people, COPY.legendEngineer.toLowerCase(), 'engineers')}`, { ...NOTE, fill: INK.secondary, attrs: NUMERIC }),
    (() => {
      const lx = x + 30 + measure(`${people} engineers`, NOTE) + 20
      return [
        h('circle', { cx: lx + 4, cy: legendY - 4, r: 4.5, fill: '#0a0a0a', stroke: '#ededed', 'stroke-opacity': 0.7 }),
        h('circle', { cx: lx + 4, cy: legendY - 4, r: 1.8, fill: '#fff' }),
        txt(lx + 14, legendY, `1 ${COPY.legendPrincipal.toLowerCase()}`, { ...NOTE, fill: INK.secondary }),
      ].join('')
    })(),
  ].join('')
}

// Comet beam round a rounded rect (signature motion) without filters: four dashes on one
// closed path (pathLength 100) — a faint wide glow, a dim tail, a brighter body and a
// white head — on one linear stroke-dashoffset loop, so the comet never jumps.
// Rest state: the comet sits on the top edge.
function cometBeam(doc, { x, y, w, h: hh, r = 12, color: c = AI.cyan, duration = 12, delay = 0, length = 14, opacity = 1 }) {
  doc.css('@keyframes ld-comet{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}.ld-comet{animation:ld-comet 12s linear infinite}')
  const d = roundedRect(x + 0.5, y + 0.5, w - 1, hh - 1, r)
  const L = length
  const layers = [
    [0, c, 3, 0.12],
    [0, c, 1.25, 0.3],
    [0.5, c, 1.25, 0.7],
    [0.82, '#ffffff', 1.25, 0.95],
  ]
  const style = `animation-duration:${duration}s${delay ? `;animation-delay:-${delay}s` : ''}`
  return h(
    'g',
    { class: 'ld-beam' },
    layers.map(([f, col, sw, op]) =>
      h('path', {
        d,
        pathLength: 100,
        stroke: col,
        'stroke-width': sw,
        'stroke-opacity': r2(op * opacity),
        'stroke-dasharray': `0 ${r2(L * f)} ${r2(L * (1 - f))} ${r2(100 - L)}`,
        'stroke-dashoffset': -6,
        class: 'ld-comet',
        style,
      }),
    ),
  )
}

function roundedRect(x, y, w, hh, r) {
  const R = Math.max(0, Math.min(r, w / 2, hh / 2))
  return `M${r2(x + R)} ${r2(y)}H${r2(x + w - R)}A${R} ${R} 0 0 1 ${r2(x + w)} ${r2(y + R)}V${r2(y + hh - R)}A${R} ${R} 0 0 1 ${r2(x + w - R)} ${r2(y + hh)}H${r2(x + R)}A${R} ${R} 0 0 1 ${r2(x)} ${r2(y + hh - R)}V${r2(y + R)}A${R} ${R} 0 0 1 ${r2(x + R)} ${r2(y)}Z`
}

// ── Right column ──────────────────────────────────────────────────────────
function side(doc, m) {
  const { x, y, w } = SIDE
  const parts = []
  parts.push(eyebrow(x, y + 14, COPY.kpiEyebrow))
  // KPI
  const kpi = TYPE.heroStat // deliberate hero KPI: the org size is this panel's headline number
  const kBase = y + 30 + capHeight(kpi)
  const value = m.people !== null ? int(m.people) : '—'
  const kfill = linearGradient(
    doc,
    'ld-kpi',
    [
      [0, '#ffffff'],
      [1, '#8f8f8f'],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  )
  parts.push(txt(x - 2, kBase, value, { ...kpi, fill: `url(#${kfill})`, attrs: NUMERIC }))
  const kx = x + measure(value, kpi) + 12
  parts.push(txt(kx, kBase - 17, COPY.kpiLabel, { ...LABEL, fill: INK.primary }))
  parts.push(txt(kx, kBase, COPY.kpiNote, { ...NOTE, fill: INK.secondary }))

  // headcount strip: 6 groups × (2 rows × 5) dots = the 60 people
  const groups = CLUSTERS
  const per = Math.round(m.people / groups)
  const pitch = 6
  const gw = 5 * pitch - 2
  const ggap = (w - groups * gw) / (groups - 1)
  const sy = kBase + 18
  const accents = [AI.blue, AI.cyan, AI.violet]
  const dots = []
  let left = m.people
  for (let g = 0; g < groups; g++) {
    const gx = x + g * (gw + ggap)
    const n = g === groups - 1 ? left : Math.min(per, left)
    left -= n
    for (let i = 0; i < n; i++) {
      const col = i % 5
      const row = Math.floor(i / 5)
      dots.push(h('rect', { x: r2(gx + col * pitch), y: sy + row * pitch, width: 4, height: 4, rx: 1, fill: i === 0 ? accents[g % 3] : '#ededed', 'fill-opacity': i === 0 ? 1 : 0.55 }))
    }
  }
  parts.push(h('g', {}, dots))

  // delivery rows
  const top = STAGE.y + STAGE.h - ROW_H * m.rows.length
  m.rows.forEach((row, i) => {
    const ry = top + i * ROW_H
    parts.push(h('path', { d: `M${x} ${ry + 0.5}H${x + w}`, stroke: color.border }))
    const cy = ry + ROW_H / 2
    // glyph tile
    parts.push(h('rect', { x: x + 0.5, y: cy - 13.5, width: 27, height: 27, rx: 7, fill: color.surface2, stroke: color.borderStrong }))
    if (hasGlyph(row.glyph)) parts.push(glyph(row.glyph, { x: x + 7, y: cy - 7, size: 14, stroke: INK.primary, strokeWidth: 1.6 }))
    const tx = x + 40
    const vw = measure(row.value, ROW_VALUE)
    const room = w - 40 - vw - 12
    parts.push(txt(tx, cy - 3, truncate(row.label, room, LABEL), { ...LABEL, fill: INK.primary }))
    const note = truncate(row.note, room - (row.meter !== undefined && row.meter !== null ? 52 : 0), NOTE)
    parts.push(txt(tx, cy + 13, note, { ...NOTE, fill: INK.tertiary, attrs: NUMERIC }))
    if (row.meter !== undefined && row.meter !== null) {
      // merge-rate meter beside the note
      const mx = tx + measure(note, NOTE) + 10
      const mw = 40
      const f = Math.max(0, Math.min(1, row.meter))
      parts.push(h('rect', { x: r2(mx), y: cy + 8.5, width: mw, height: 3, rx: 1.5, fill: color.surface3 }))
      parts.push(h('rect', { x: r2(mx), y: cy + 8.5, width: r2(mw * f), height: 3, rx: 1.5, fill: color.blueBright }))
    }
    parts.push(txt(x + w, cy + capHeight(ROW_VALUE) / 2, row.value, { ...ROW_VALUE, fill: row.value === '—' ? INK.tertiary : INK.primary, anchor: 'end', attrs: NUMERIC }))
  })
  parts.push(h('path', { d: `M${x} ${STAGE.y + STAGE.h - 0.5}H${x + w}`, stroke: color.border }))
  return parts.join('')
}

// ── Pillars ───────────────────────────────────────────────────────────────
function pillars(doc) {
  const list = (leadership.pillars ?? []).slice(0, 4)
  const tileFill = linearGradient(
    doc,
    'ld-tile',
    [
      [0, AI.blue, 0.32],
      [0.55, AI.cyan, 0.14],
      [1, AI.violet, 0.3],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 1 },
  )
  const tileEdge = linearGradient(
    doc,
    'ld-tile-edge',
    [
      [0, '#ffffff', 0.42],
      [1, '#ffffff', 0.08],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 1 },
  )
  return list
    .map((p, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = PAD + col * (PILLAR_W + GAP)
      const y = PILLAR_TOP + row * (PILLAR_H + GAP)
      const tx = x + 20 + TILE + 16
      const room = x + PILLAR_W - 20 - tx
      const lines = wrap(p.text ?? '', room, PILLAR_TEXT).slice(0, 2)
      if (wrap(p.text ?? '', room, PILLAR_TEXT).length > 2) lines[1] = truncate(`${lines[1]}…`, room, PILLAR_TEXT)
      const ty = y + 20
      const out = [
        card(doc, { x, y, w: PILLAR_W, h: PILLAR_H, r: 12, fill: color.surface }),
        shineSweep(doc, { x, y, w: PILLAR_W, h: PILLAR_H, r: 12, duration: 12, delay: r2(12 - i * 0.5 - row * 0.3), opacity: 0.06 }),
        h('rect', { x: x + 20.5, y: ty + 0.5, width: TILE - 1, height: TILE - 1, rx: 8, fill: '#0b0d12' }),
        h('rect', { x: x + 20.5, y: ty + 0.5, width: TILE - 1, height: TILE - 1, rx: 8, fill: `url(#${tileFill})`, stroke: `url(#${tileEdge})` }),
        p.glyph && hasGlyph(p.glyph) ? glyph(p.glyph, { x: x + 20 + 9, y: ty + 9, size: 18, stroke: '#ffffff', strokeWidth: 1.6 }) : '',
        txt(tx, ty + capHeight(PILLAR_TITLE), truncate(p.title ?? '', room, PILLAR_TITLE), { ...PILLAR_TITLE, fill: INK.primary }),
        ...lines.map((line, j) => txt(tx, ty + capHeight(PILLAR_TITLE) + 21 + j * 19, line, { ...PILLAR_TEXT, fill: INK.secondary })),
      ]
      return out.join('')
    })
    .join('')
}

// ── Render ────────────────────────────────────────────────────────────────
function render(data) {
  const m = model(data)
  const [pr, commits, weeks] = m.rows
  const desc = [
    `Engineering organization: ${COPY.role} leading ${m.people} engineers, drawn as an org constellation of six clusters around one principal node.`,
    (() => {
      const facts = [
        pr.value !== '—' ? `${pr.value} pull requests${pr.meter !== null ? ` (${pr.note})` : ''}` : null,
        commits.value !== '—' ? `${commits.value} commits` : null,
        weeks.value !== '—' ? `${weeks.value} consecutive weeks shipping` : null,
      ].filter(Boolean)
      return facts.length ? `Delivery from GitHub: ${facts.join(', ')}.` : 'Delivery metrics from GitHub are unavailable.'
    })(),
    `Leadership pillars: ${(leadership.pillars ?? []).map((p) => `${p.title} — ${p.text}`).join(' ')}`,
  ].join(' ')
  const doc = createDoc({ width: W, height: H, title: `${COPY.title} — ${m.people} engineers`, desc })
  const clip = panelClip(doc)
  const header = panelHeader(doc, {
    icon: { glyph: 'users' },
    title: COPY.title,
    subtitle: COPY.subtitle,
    pills: [freshnessPill(freshness(data, 'github'))],
  })
  const footer = panelFooter(doc, {
    y: H - PANEL.footer,
    left: [['Role', COPY.role]],
    right: [['Source', COPY.source]],
  })
  const glow = radialGradient(doc, 'ld-top-glow', [
    [0, color.amber, 0.1],
    [0.5, color.amber, 0.025],
    [1, color.amber, 0],
  ])
  const marks = [
    [PAD, TOP],
    [W - PAD, TOP],
    [PAD, PILLARS_BOTTOM],
    [W - PAD, PILLARS_BOTTOM],
  ].map(([cx, cy]) => crosshair(cx, cy, { stroke: color.textMuted }))
  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, h('ellipse', { cx: W / 2, cy: 0, rx: W * 0.5, ry: 120, fill: `url(#${glow})` })),
    header.markup,
    marks,
    stage(doc, m.people),
    side(doc, m),
    pillars(doc),
    footer.markup,
  )
}

export default {
  name: 'leadership',
  render({ data } = {}) {
    return [{ path: 'assets/leadership.svg', svg: render(data ?? {}) }]
  },
}
