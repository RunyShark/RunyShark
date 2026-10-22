// Hall of fame — a trophy cabinet, hardest first. A three-step podium of the
// hardest trophies (custom-drawn metal: an iridescent secret gem, a gold ×4
// medallion and a gold SSS cup) under amber spotlights with rising sparkles and
// staggered shine sweeps, then a 4×2 grid of smaller trophy cards, each with a
// metal coin, a tier badge, the criterion with its real number and a source tag.
//
// Truth: tiers and ranks are the verified snapshot in content.mjs (`achievements`,
// GitHub exposes neither through its API); every number is read from metrics.json
// at render time and falls back to wording without a number when it is missing.

import { achievements as SNAPSHOT, profile } from '../content.mjs'
import { compact, date, int, percent } from '../core/format.mjs'
import { glyph } from '../core/glyphs.mjs'
import { orbit, particles, shineSweep, stagger, starfield } from '../core/motion.mjs'
import { card, crosshair, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, h, panel } from '../core/svg.mjs'
import { centerBaseline, measure, truncate, txt, wrap } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'
import { INK, NUMERIC, PANEL, TYPE, freshness, freshnessPill, panelFooter, panelHeader } from './shared/panel.mjs'

// ── Layout ────────────────────────────────────────────────────────────────
const W = PANEL.width
const PAD = PANEL.pad
const GAP = PANEL.gap
const INNER_W = W - PAD * 2 // 796

const PODIUM_TOP = PANEL.toolbar + PAD // 96
const PODIUM_H = 304
const PODIUM_W = (INNER_W - GAP * 2) / 3 // 254.67
const ART_TOP = 46 // art region inside a podium card (offsets from the card top)
const FLOOR = 208 // floor line the plinths stand on
const PLINTH_W = 124
const PLINTH_H = { 1: 40, 2: 28, 3: 18 }

const GRID_TOP = PODIUM_TOP + PODIUM_H + GAP
const COLS = 4
const ROWS = 2
const CARD_W = (INNER_W - GAP * (COLS - 1)) / COLS // 187
const CARD_H = 156
const CARD_PAD = 16
const COIN = 36
const GRID_BOTTOM = GRID_TOP + ROWS * CARD_H + (ROWS - 1) * GAP
const H = GRID_BOTTOM + PAD + PANEL.footer

const BADGE = { size: 11, family: 'mono', weight: 500, tracking: 0.06 }
const TAG = { size: 11, family: 'mono', weight: 400, tracking: 0.08 }
const NAME_L = { size: 18, weight: 600, tracking: -0.02 }
const NAME_S = { size: 14, weight: 600, tracking: -0.01 }
const CRIT = { size: 13, weight: 400 }
const ENGRAVE = { size: 12, family: 'mono', weight: 500, tracking: 0.12 }

// ── Metals (DESIGN.md rule 5: trophies only) ─────────────────────────────
// Stops run across a cylinder: dark edge → hot highlight → body → dark edge.
const OFFSETS = [0, 0.14, 0.3, 0.44, 0.62, 0.82, 1]
const METAL = {
  gold: { stops: ['#6b430c', '#c98a22', '#ffe9a8', '#ffd27a', '#f5a524', '#b7791f', '#5c3a05'], ink: '#3a2404', text: '#ffd27a', line: '#f5a524', glow: '#f5a524' },
  secret: { stops: ['#241d5c', '#7c6cf0', '#e4dbff', '#a78bfa', '#47c9e5', '#52a8ff', '#1d2462'], ink: '#140f33', text: '#cfc2ff', line: '#a78bfa', glow: '#a78bfa' },
  silver: { stops: ['#3f444a', '#8f959d', '#f4f6f8', '#c8ccd2', '#9aa1aa', '#6b7179', '#353a40'], ink: '#202429', text: '#dfe3e8', line: '#aab0b8', glow: '#c8ccd2' },
  bronze: { stops: ['#3d200b', '#8a4f22', '#f6c69d', '#c98448', '#a8622b', '#7a4319', '#331a08'], ink: '#2a1407', text: '#f0b98a', line: '#c07a3e', glow: '#c07a3e' },
  graphite: { stops: ['#161616', '#2e2e2e', '#6a6a6a', '#454545', '#2e2e2e', '#222222', '#121212'], ink: '#ededed', text: '#ededed', line: '#454545', glow: '#878787' },
}

const AMBER = color.amber
const SPARKS = {
  gold: ['#ffd27a', '#f5a524', '#fff1c9'],
  secret: ['#c4b5fd', '#47c9e5', '#e4dbff', '#ffd27a'],
}

// ── Data helpers ──────────────────────────────────────────────────────────
const r2 = (v) => Math.round(v * 100) / 100
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const arr = (v) => (Array.isArray(v) ? v : [])
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthYear(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}/.test(iso)) return null
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
}

function snapTrophy(id) {
  return arr(SNAPSHOT?.trophies).find((t) => t.id === id) ?? null
}

function snapGithub(id) {
  return arr(SNAPSHOT?.github).find((a) => a.id === id) ?? null
}

// Metal for a github-profile-trophy rank: SECRET → iridescent, S ranks → gold,
// A ranks → silver, below → bronze.
function rankMetal(rank) {
  const r = String(rank ?? '').toUpperCase()
  if (r === 'SECRET') return 'secret'
  if (r.startsWith('S')) return 'gold'
  if (r.startsWith('A')) return 'silver'
  return r ? 'bronze' : 'graphite'
}

function rankLabel(rank) {
  const r = String(rank ?? '').toUpperCase()
  if (!r) return null
  return r === 'SECRET' ? 'Secret' : `${r} rank`
}

function tierLabel(a) {
  if (!a) return null
  if (!a.tier) return 'Unlocked'
  const name = a.tier[0].toUpperCase() + a.tier.slice(1)
  return a.count > 1 ? `${name} ×${a.count}` : name
}

/**
 * Every entry of the cabinet, rarest first, with numbers resolved from metrics.
 * Entries whose snapshot record is missing are dropped; numbers that are missing
 * fall back to a sentence without a number.
 */
function model(data) {
  const user = data?.user ?? {}
  const c = data?.contributions ?? {}
  const pr = data?.pullRequests ?? {}
  const commits = num(user.totalCommits)
  const merged = num(pr.merged)
  const prTotal = num(pr.total)
  const mergeRate = num(pr.mergeRate)
  const weeks = num(c.weeklyStreak?.current?.weeks)
  const weeksSince = monthYear(c.weeklyStreak?.current?.start)
  const best = num(c.bestDay?.count)
  const bestDate = c.bestDay?.date ? date(c.bestDay.date) : null
  const years = num(user.yearsOnGitHub)
  const since = monthYear(user.createdAt)
  const langCount = arr(data?.languages).filter((l) => l?.name && l.name !== 'Other').length || null

  const sss = snapTrophy('AchieveSSSRank')
  const god = snapTrophy('Commits')
  const puller = snapTrophy('PullRequest')
  const rainbow = snapTrophy('MultiLanguage')
  const elder = snapTrophy('LongTimeUser')
  const shark = snapGithub('pull-shark')
  const pair = snapGithub('pair-extraordinaire')
  const quick = snapGithub('quickdraw')
  const yolo = snapGithub('yolo')

  const podium = [
    sss && {
      place: 1,
      art: 'gem',
      metal: rankMetal(sss.rank),
      badge: rankLabel(sss.rank),
      name: sss.name,
      text: god ? `Secret trophy, unlocked by an ${god.rank}-rank ${god.name}` : 'Secret trophy for holding an SSS rank',
      source: 'Trophy',
      stat: god?.rank ?? 'SSS',
    },
    shark && {
      place: 2,
      art: 'medal',
      metal: shark.tier ?? 'graphite',
      badge: tierLabel(shark),
      name: shark.name,
      text: merged ? `Top tier, earned with ${int(merged)} merged pull requests` : 'Top tier, earned with merged pull requests',
      source: 'GitHub',
      stat: shark.count > 1 ? `×${shark.count}` : null,
    },
    god && {
      place: 3,
      art: 'cup',
      metal: rankMetal(god.rank),
      badge: rankLabel(god.rank),
      name: god.name,
      text: commits ? `${int(commits)} commits, the highest commit rank` : 'The highest commit rank',
      source: 'Trophy',
      stat: commits ? compact(commits) : null,
    },
  ].filter(Boolean)

  // Hardest first: an S-rank trophy, the two records, then the secret and GitHub badges.
  const grid = [
    puller && {
      glyph: 'gitPullRequest',
      metal: rankMetal(puller.rank),
      badge: rankLabel(puller.rank),
      name: puller.name,
      text: prTotal ? `${int(prTotal)} pull requests${mergeRate !== null ? `, ${percent(mergeRate)} merged` : ''}` : 'Pull requests at scale',
      source: 'Trophy',
    },
    {
      glyph: 'flame',
      metal: 'silver',
      badge: 'Record',
      name: 'Unbroken streak',
      text: weeks ? `${int(weeks)} weeks in a row${weeksSince ? `, since ${weeksSince}` : ' with contributions'}` : 'Contributions every single week',
      source: 'Record',
    },
    {
      glyph: 'zap',
      metal: 'silver',
      badge: 'Record',
      name: 'Best day',
      text: best ? `${int(best)} contributions${bestDate ? ` on ${bestDate}` : ' in one day'}` : 'Most contributions in a single day',
      source: 'Record',
    },
    rainbow && {
      glyph: 'code',
      metal: rankMetal(rainbow.rank),
      badge: rankLabel(rainbow.rank),
      name: rainbow.name,
      text: langCount ? `${langCount} languages shipped across repositories` : 'Many languages shipped across repositories',
      source: 'Trophy',
    },
    elder && {
      glyph: 'clock',
      metal: rankMetal(elder.rank),
      badge: rankLabel(elder.rank),
      name: elder.name,
      text: years && years >= 1 ? `${Math.floor(years)} years on GitHub${since ? `, since ${since}` : ''}` : 'A long-time GitHub member',
      source: 'Trophy',
    },
    pair && {
      glyph: 'users',
      metal: pair.tier ?? 'graphite',
      badge: tierLabel(pair),
      name: pair.name,
      text: 'Co-authored pull requests, merged',
      source: 'GitHub',
    },
    quick && {
      glyph: 'timer',
      metal: quick.tier ?? 'graphite',
      badge: tierLabel(quick),
      name: quick.name,
      text: 'Closed an issue or PR within 5 minutes',
      source: 'GitHub',
    },
    yolo && {
      glyph: 'rocket',
      metal: yolo.tier ?? 'graphite',
      badge: tierLabel(yolo),
      name: yolo.name,
      text: 'Merged a pull request without a review',
      source: 'GitHub',
    },
  ].filter(Boolean)

  return { podium, grid: grid.slice(0, COLS * ROWS) }
}

// ── Defs ──────────────────────────────────────────────────────────────────
function metalDefs(doc) {
  for (const [key, m] of Object.entries(METAL)) {
    const stops = m.stops.map((c, i) => [OFFSETS[i], c])
    linearGradient(doc, `ach-${key}`, stops, { x1: 0, y1: 0, x2: 1, y2: 0 }) // cylinder (trophies)
    linearGradient(doc, `ach-${key}-d`, stops, { x1: 0, y1: 0, x2: 1, y2: 1 }) // diagonal (coins, plates)
  }
  // Second iridescent sheet cross-fading over the gem, so the colours shift.
  linearGradient(
    doc,
    'ach-secret-shift',
    [
      [0, '#47c9e5', 0.9],
      [0.35, '#f0e9ff', 0.85],
      [0.6, '#a78bfa', 0.9],
      [1, '#52a8ff', 0.9],
    ],
    { x1: 1, y1: 0, x2: 0, y2: 1 },
  )
  // Spotlight cone + floor pools.
  linearGradient(
    doc,
    'ach-cone',
    [
      [0, AMBER, 0.2],
      [0.55, AMBER, 0.07],
      [1, AMBER, 0],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  )
  for (const key of ['gold', 'secret']) {
    radialGradient(doc, `ach-pool-${key}`, [
      [0, METAL[key].glow, 0.34],
      [0.5, METAL[key].glow, 0.1],
      [1, METAL[key].glow, 0],
    ])
  }
  radialGradient(doc, 'ach-halo', [
    [0, '#fff3d1', 0.22],
    [0.45, AMBER, 0.08],
    [1, AMBER, 0],
  ])
  linearGradient(
    doc,
    'ach-plinth',
    [
      [0, '#1c1c1c'],
      [1, '#0b0b0b'],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  )
  linearGradient(
    doc,
    'ach-plinth-top',
    [
      [0, '#ffffff', 0],
      [0.5, '#ffffff', 0.35],
      [1, '#ffffff', 0],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 0 },
  )
  doc.css(`@keyframes ach-spot{0%,100%{opacity:1}50%{opacity:.62}}.ach-spot{animation:ach-spot 7s ease-in-out infinite}
@keyframes ach-shift{0%,100%{opacity:0}50%{opacity:.55}}.ach-shift{animation:ach-shift 6s ease-in-out infinite}`)
}

// ── Trophy art (local coords: origin = bottom centre, y up is negative) ──
// Each returns { markup, clip: [d…], top } — `clip` is the solid silhouette the
// shine sweep is clipped to, `top` its highest y.

function plate(m, x0, x1, y0, y1, r = 3) {
  return h('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: r, fill: `url(#ach-${m})` })
}

function rectD(x0, y0, x1, y1) {
  return `M${x0} ${y0}H${x1}V${y1}H${x0}Z`
}

// Faceted gem on a plinth stand with an engraved "SSS" base.
function gemArt(m, label) {
  const ink = METAL[m].ink
  const girdle = -102
  const table = -122
  const tip = -46
  const crown = [
    [-46, girdle],
    [-28, table],
    [28, table],
    [46, girdle],
  ]
  const facets = [
    // pavilion (tip → girdle points), alternating light
    { d: `M0 ${tip}L-46 ${girdle}L-16 ${girdle}Z`, o: 0 },
    { d: `M0 ${tip}L-16 ${girdle}L16 ${girdle}Z`, o: 0.22 },
    { d: `M0 ${tip}L16 ${girdle}L46 ${girdle}Z`, o: 0.08 },
    // crown
    { d: `M-46 ${girdle}L-28 ${table}L-16 ${girdle}Z`, o: 0.3 },
    { d: `M-28 ${table}L28 ${table}L16 ${girdle}L-16 ${girdle}Z`, o: 0.42 },
    { d: `M28 ${table}L46 ${girdle}L16 ${girdle}Z`, o: 0.12 },
  ]
  const gemD = `M${crown.map((p) => p.join(' ')).join('L')}L0 ${tip}Z`
  const parts = [
    // base + engraved plaque
    plate(`${m}-d`, -46, 46, -24, 0, 4),
    h('rect', { x: -46, y: -24, width: 92, height: 2, fill: '#ffffff', 'fill-opacity': 0.28 }),
    txt(0, r2(centerBaseline(-11.5, ENGRAVE)), label, { ...ENGRAVE, fill: ink, anchor: 'middle' }),
    // stand: post + prongs cradling the tip
    plate(m, -5, 5, -40, -24, 1),
    h('path', { d: `M-22 -25C-20 -36 -10 -44 -5 ${tip - 3}M22 -25C20 -36 10 -44 5 ${tip - 3}`, stroke: `url(#ach-${m})`, 'stroke-width': 3.5, 'stroke-linecap': 'round' }),
    // gem body
    h('path', { d: gemD, fill: `url(#ach-${m}-d)` }),
    h('path', { d: gemD, fill: 'url(#ach-secret-shift)', class: 'ach-shift', style: 'animation-delay:-1.5s' }),
    facets.map((f) => (f.o ? h('path', { d: f.d, fill: '#ffffff', 'fill-opacity': f.o }) : '')),
    h('path', {
      d: [`M-46 ${girdle}H46`, `M-16 ${girdle}L0 ${tip}L16 ${girdle}`, `M-28 ${table}L-16 ${girdle}`, `M28 ${table}L16 ${girdle}`].join(''),
      stroke: '#ffffff',
      'stroke-opacity': 0.55,
      'stroke-width': 0.8,
      'stroke-linejoin': 'round',
    }),
    h('path', { d: gemD, stroke: '#ffffff', 'stroke-opacity': 0.7, 'stroke-width': 1, 'stroke-linejoin': 'round' }),
  ]
  return { markup: parts.join(''), clip: [gemD, rectD(-46, -24, 46, 0)], top: table, center: (girdle + tip) / 2 - 6 }
}

// Rosette medallion on a short post (Pull Shark): scalloped rim, ring, shark fin.
function medalArt(m, label) {
  const ink = METAL[m].ink
  const cy = -72
  const R = 44
  const points = []
  const n = 28
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2
    const rr = i % 2 ? R - 4 : R
    points.push(`${r2(Math.cos(a) * rr)} ${r2(cy + Math.sin(a) * rr)}`)
  }
  const rosette = `M${points.join('L')}Z`
  const B = cy + 10
  const fin = `M-20 ${B}C-10 ${B - 4} -2 ${B - 22} 12 ${B - 30}C6 ${B - 20} 6 ${B - 8} 16 ${B}Z`
  const wave = `M-26 ${cy + 15}c4.33 -3 8.67 -3 13 0s8.67 3 13 0s8.67 -3 13 0s8.67 3 13 0`
  const parts = [
    plate(`${m}-d`, -36, 36, -14, 0, 4),
    h('rect', { x: -36, y: -14, width: 72, height: 2, fill: '#ffffff', 'fill-opacity': 0.28 }),
    plate(m, -5, 5, -30, -14, 1),
    h('path', { d: rosette, fill: `url(#ach-${m}-d)` }),
    h('circle', { cx: 0, cy, r: R - 9, fill: `url(#ach-${m})` }),
    h('circle', { cx: 0, cy, r: R - 9, stroke: ink, 'stroke-opacity': 0.45, 'stroke-width': 1.5 }),
    h('circle', { cx: 0, cy, r: R - 14, stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': 1 }),
    h('path', { d: fin, fill: ink, 'fill-opacity': 0.85 }),
    h('path', { d: wave, stroke: ink, 'stroke-opacity': 0.85, 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
    label ? txt(0, r2(centerBaseline(-7, ENGRAVE)), label, { ...ENGRAVE, fill: ink, anchor: 'middle', attrs: NUMERIC }) : '',
  ]
  return { markup: parts.join(''), clip: [rosette, rectD(-36, -14, 36, 0)], top: cy - R, center: cy }
}

// Classic two-handled cup with a star and an engraved base (God Committer).
function cupArt(m, label) {
  const ink = METAL[m].ink
  const rim = -116
  const bowl = `M-38 ${rim}H38C38 -84 26 -62 0 -58C-26 -62 -38 -84 -38 ${rim}Z`
  const star = (cx, cy, R, r) => {
    const pts = []
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * i) / 5 - Math.PI / 2
      const rr = i % 2 ? r : R
      pts.push(`${r2(cx + Math.cos(a) * rr)} ${r2(cy + Math.sin(a) * rr)}`)
    }
    return `M${pts.join('L')}Z`
  }
  const parts = [
    // handles (behind the bowl)
    h('path', { d: `M-34 -106C-60 -108 -60 -74 -26 -70`, stroke: `url(#ach-${m})`, 'stroke-width': 6, 'stroke-linecap': 'round' }),
    h('path', { d: `M34 -106C60 -108 60 -74 26 -70`, stroke: `url(#ach-${m})`, 'stroke-width': 6, 'stroke-linecap': 'round' }),
    // base
    plate(`${m}-d`, -40, 40, -22, 0, 4),
    h('rect', { x: -40, y: -22, width: 80, height: 2, fill: '#ffffff', 'fill-opacity': 0.28 }),
    txt(0, r2(centerBaseline(-10.5, ENGRAVE)), label, { ...ENGRAVE, fill: ink, anchor: 'middle' }),
    plate(m, -26, 26, -30, -22, 2),
    // stem + knot
    h('path', { d: 'M-9 -30L-4 -52H4L9 -30Z', fill: `url(#ach-${m})` }),
    h('ellipse', { cx: 0, cy: -54, rx: 11, ry: 4.5, fill: `url(#ach-${m})` }),
    // bowl, rim, star
    h('path', { d: bowl, fill: `url(#ach-${m})` }),
    h('ellipse', { cx: 0, cy: rim, rx: 38, ry: 5, fill: `url(#ach-${m}-d)` }),
    h('ellipse', { cx: 0, cy: rim, rx: 33, ry: 3, fill: ink, 'fill-opacity': 0.55 }),
    h('path', { d: star(0, -90, 13, 5.6), fill: ink, 'fill-opacity': 0.8 }),
    h('path', { d: 'M-30 -104C-28 -86 -20 -72 -10 -66', stroke: '#ffffff', 'stroke-opacity': 0.4, 'stroke-width': 2, 'stroke-linecap': 'round' }),
  ]
  return { markup: parts.join(''), clip: [bowl, rectD(-40, -22, 40, 0), rectD(-26, -30, 26, -22)], top: rim - 5, center: -86 }
}

// ── Pieces ────────────────────────────────────────────────────────────────
/**
 * Border beam without a blur filter. The README shows ~20 animated SVGs at once and
 * an SVG <img> is re-rasterised on every animation frame, so a feGaussianBlur on a
 * moving stroke costs a full filter pass per frame. The glow is a wide, faint twin
 * stroke instead. Butt caps: a zero-length dash with round caps would leave a dot.
 * Rest state: the segment sits just past the top-left corner.
 */
function beam(doc, { x = 0, y = 0, w, h: hh, r = 12, color: c, duration = 12, delay = 0, length = 80, width = 1.25 }) {
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

/** Tier badge: mono uppercase pill in the tier's metal tone. → { width, markup } */
function badge(doc, { x, cy, text, metal, align = 'start', height = 22 }) {
  if (!text) return { width: 0, markup: '' }
  const label = String(text).toUpperCase()
  const m = METAL[metal] ?? METAL.graphite
  const width = Math.ceil(measure(label, BADGE) + 18)
  const left = align === 'end' ? x - width : x
  const top = cy - height / 2
  const neutral = metal === 'graphite'
  return {
    width,
    markup: [
      h('rect', {
        x: r2(left + 0.5),
        y: r2(top + 0.5),
        width: width - 1,
        height: height - 1,
        rx: (height - 1) / 2,
        fill: neutral ? color.surface3 : m.line,
        'fill-opacity': neutral ? null : 0.12,
        stroke: neutral ? color.borderStrong : metal === 'secret' ? 'url(#ach-secret-d)' : m.line,
        'stroke-opacity': neutral ? null : metal === 'secret' ? 0.9 : 0.45,
      }),
      txt(r2(left + width / 2 + 0.5), r2(centerBaseline(cy, BADGE)), label, { ...BADGE, fill: m.text, anchor: 'middle', attrs: NUMERIC }),
    ].join(''),
  }
}

/** Wrap to at most `max` lines; the last line carries the remainder, truncated. */
function fitLines(text, width, font, max = 2) {
  const lines = wrap(text, width, font)
  if (lines.length <= max) return lines
  return [...lines.slice(0, max - 1), truncate(lines.slice(max - 1).join(' '), width, font)]
}

function sourceTag(x, y, text, anchor = 'start') {
  return txt(r2(x), r2(y), String(text).toUpperCase(), { ...TAG, fill: INK.tertiary, anchor })
}

function podiumCard(doc, item, x, i) {
  const y = PODIUM_TOP
  const w = PODIUM_W
  const cx = x + w / 2
  const m = item.metal
  const accent = m === 'secret' ? 'secret' : 'gold'
  const ph = PLINTH_H[item.place] ?? 24
  const floorY = y + FLOOR
  const standY = floorY - ph
  const clipId = `ach-card-${i}`
  doc.def(clipId, h('clipPath', { id: clipId }, h('rect', { x: r2(x), y, width: r2(w), height: PODIUM_H, rx: 12 })))
  const parts = [card(doc, { x: r2(x), y, w: r2(w), h: PODIUM_H, r: 12, glow: { color: METAL[accent].glow, opacity: item.place === 1 ? 0.2 : 0.14, height: 150 } })]

  // deep-space backdrop + spotlight, clipped to the card
  const back = [
    starfield(doc, { x: x + 8, y: y + 40, w: w - 16, h: FLOOR - 40, count: 34, seed: `ach-${i}`, flares: 1, opacity: 0.75, avoid: [{ x: cx - 64, y: y + ART_TOP, w: 128, h: FLOOR - ART_TOP }] }),
    h(
      'g',
      { class: 'ach-spot', style: `animation-delay:${stagger(i, 3, 7)}` },
      h('path', { d: `M${r2(cx - 16)} ${y}H${r2(cx + 16)}L${r2(cx + 96)} ${floorY}H${r2(cx - 96)}Z`, fill: 'url(#ach-cone)' }),
      h('ellipse', { cx: r2(cx), cy: y, rx: 60, ry: 26, fill: 'url(#ach-halo)' }),
    ),
    h('ellipse', { cx: r2(cx), cy: floorY, rx: 108, ry: 20, fill: `url(#ach-pool-${accent})` }),
    // floor line
    h('path', { d: `M${r2(x + 20)} ${floorY + 0.5}H${r2(x + w - 20)}`, stroke: color.border }),
  ]
  parts.push(h('g', { 'clip-path': `url(#${clipId})` }, back))

  // plinth with the place number
  const px = cx - PLINTH_W / 2
  parts.push(
    h('rect', { x: r2(px + 0.5), y: r2(standY + 0.5), width: PLINTH_W - 1, height: ph, rx: 3, fill: 'url(#ach-plinth)', stroke: color.borderStrong }),
    h('path', { d: `M${r2(px + 4)} ${standY + 0.5}H${r2(px + PLINTH_W - 4)}`, stroke: 'url(#ach-plinth-top)' }),
    ph >= 16
      ? txt(r2(cx), r2(centerBaseline(standY + ph / 2 + 0.5, TAG)), String(item.place), { ...TAG, fill: INK.tertiary, anchor: 'middle', attrs: NUMERIC })
      : '',
  )

  // rising sparks around the trophy (behind the metal, so they never sit on an engraving)
  parts.push(
    particles(doc, {
      x: cx - 104,
      y: y + ART_TOP - 6,
      w: 208,
      h: standY - (y + ART_TOP) + 4,
      count: 18,
      seed: `ach-sparks-${i}`,
      direction: 'up',
      colors: SPARKS[accent],
      sizes: [0.8, 1.9],
    }),
  )

  // trophy art, scaled to the room above the plinth
  const engrave = item.art === 'medal' ? item.stat ?? '' : item.art === 'gem' ? item.stat ?? 'SSS' : (item.badge ?? '').replace(/ rank$/i, '')
  const art = item.art === 'gem' ? gemArt(m, engrave) : item.art === 'medal' ? medalArt(m, engrave) : cupArt(m, engrave)
  const room = standY - (y + ART_TOP)
  const scale = Math.min(1, room / -art.top)
  const silhouette = `ach-sil-${i}`
  doc.def(silhouette, h('clipPath', { id: silhouette }, art.clip.map((d) => h('path', { d }))))
  const artCy = art.center
  const extras = []
  if (item.art === 'gem') {
    extras.push(orbit(doc, { cx: 0, cy: artCy, r: 58, count: 3, duration: 18, seed: 'ach-gem', dot: { r: 2, fill: ['#a78bfa', '#47c9e5', '#e4dbff'] }, ring: true }))
  }
  parts.push(
    h(
      'g',
      { transform: `translate(${r2(cx)} ${r2(standY)}) scale(${r2(scale)})` },
      extras,
      art.markup,
      h(
        'g',
        { 'clip-path': `url(#${silhouette})` },
        shineSweep(doc, { x: -70, y: art.top - 4, w: 140, h: -art.top + 4, r: 0, duration: 7.5, delay: 1.2 + i * 2.4, angle: 22, opacity: 0.85, band: 44 }),
      ),
    ),
  )

  // header row: tier badge left, source tag right
  const b = badge(doc, { x: x + 20, cy: y + 30, text: item.badge, metal: m })
  parts.push(b.markup, sourceTag(x + w - 20, centerBaseline(y + 30, TAG), item.source, 'end'))

  // copy
  const tw = w - 40
  parts.push(txt(r2(x + 20), y + 240, truncate(item.name, tw, NAME_L), { ...NAME_L, fill: INK.primary }))
  fitLines(item.text, tw, CRIT)
    .forEach((line, li) => parts.push(txt(r2(x + 20), y + 263 + li * 18, line, { ...CRIT, fill: INK.secondary, attrs: NUMERIC })))

  if (item.place === 1) parts.push(beam(doc, { x: r2(x), y, w: r2(w), h: PODIUM_H, r: 12, color: METAL[m].line, duration: 9, length: 110, delay: 2 }))
  return parts.join('')
}

function coin(doc, { cx, cy, metal, icon, i }) {
  const m = METAL[metal] ?? METAL.graphite
  const R = COIN / 2
  return [
    h('circle', { cx: r2(cx), cy: r2(cy), r: R + 7, fill: `url(#ach-pool-${metal === 'secret' ? 'secret' : 'gold'})`, opacity: metal === 'graphite' ? 0.35 : 0.8 }),
    h('circle', { cx: r2(cx), cy: r2(cy), r: R, fill: `url(#ach-${metal}-d)` }),
    h('circle', { cx: r2(cx), cy: r2(cy), r: R - 3.5, stroke: m.ink, 'stroke-opacity': metal === 'graphite' ? 0.9 : 0.35, 'stroke-width': 1 }),
    h('circle', { cx: r2(cx), cy: r2(cy), r: R - 0.5, stroke: '#ffffff', 'stroke-opacity': metal === 'graphite' ? 0.12 : 0.3, 'stroke-width': 1 }),
    glyph(icon, { x: r2(cx - 8.5), y: r2(cy - 8.5), size: 17, stroke: m.ink, strokeWidth: 2 }),
    shineSweep(doc, { x: r2(cx - R), y: r2(cy - R), w: COIN, h: COIN, r: R, duration: 8, delay: r2(0.6 + i * 0.95), angle: 24, opacity: metal === 'graphite' ? 0.22 : 0.6, band: 14 }),
  ].join('')
}

function gridCard(doc, item, i) {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const x = PAD + col * (CARD_W + GAP)
  const y = GRID_TOP + row * (CARD_H + GAP)
  const tint = METAL[item.metal] ?? METAL.graphite
  const parts = [card(doc, { x: r2(x), y, w: r2(CARD_W), h: CARD_H, r: 12, glow: item.metal === 'graphite' ? null : { color: tint.glow, opacity: 0.1, height: 90 } })]
  const ccy = y + CARD_PAD + COIN / 2
  parts.push(coin(doc, { cx: x + CARD_PAD + COIN / 2, cy: ccy, metal: item.metal, icon: item.glyph, i }))
  parts.push(badge(doc, { x: x + CARD_W - CARD_PAD, cy: ccy, text: item.badge, metal: item.metal, align: 'end', height: 20 }).markup)
  const tw = CARD_W - CARD_PAD * 2
  parts.push(txt(r2(x + CARD_PAD), y + 80, truncate(item.name, tw, NAME_S), { ...NAME_S, fill: INK.primary }))
  fitLines(item.text, tw, CRIT)
    .forEach((line, li) => parts.push(txt(r2(x + CARD_PAD), y + 101 + li * 18, line, { ...CRIT, fill: INK.secondary, attrs: NUMERIC })))
  parts.push(sourceTag(x + CARD_PAD, y + CARD_H - CARD_PAD, item.source))
  return parts.join('')
}

// ── Render ────────────────────────────────────────────────────────────────
function describe(m) {
  const top = m.podium
    .slice()
    .sort((a, b) => a.place - b.place)
    .map((t) => `${t.name} (${t.badge}): ${t.text}`)
  const rest = m.grid.map((t) => `${t.name} (${t.badge}): ${t.text}`)
  return `Trophy cabinet, hardest first. Podium: ${top.join('; ')}. Also earned: ${rest.join('; ')}.`
}

export function render({ data = {} } = {}) {
  const m = model(data)
  const earned = [...m.podium, ...m.grid].filter((t) => t.source !== 'Record').length
  const doc = createDoc({ width: W, height: H, title: `${profile.login} · Hall of fame`, desc: describe(m) })
  metalDefs(doc)

  const head = panelHeader(doc, {
    icon: { glyph: 'trophy' },
    title: 'Trophy cabinet',
    subtitle: 'Hardest first',
    pills: [
      // records are not trophies: count only what GitHub / github-profile-trophy awarded
      { label: 'Verified', value: `${earned} trophies`, glyph: 'shieldCheck' },
      freshnessPill(freshness(data, 'github')),
    ],
  })

  // Podium order left → right: 2 · 1 · 3.
  const byPlace = new Map(m.podium.map((t) => [t.place, t]))
  const slots = [byPlace.get(2), byPlace.get(1), byPlace.get(3)]
  const podium = slots.map((item, i) => (item ? podiumCard(doc, item, PAD + i * (PODIUM_W + GAP), i) : '')).join('')
  const grid = m.grid.map((item, i) => gridCard(doc, item, i)).join('')

  const marks = [
    [PAD, PODIUM_TOP - GAP / 2],
    [W - PAD, PODIUM_TOP - GAP / 2],
    [PAD, GRID_TOP - GAP / 2],
    [W - PAD, GRID_TOP - GAP / 2],
    [PAD, GRID_BOTTOM + GAP],
    [W - PAD, GRID_BOTTOM + GAP],
  ].map(([cx, cy]) => crosshair(cx, cy, { size: 9 }))

  const foot = panelFooter(doc, {
    y: H - PANEL.footer,
    left: [['Sources', 'GitHub achievements · github-profile-trophy · GitHub GraphQL API']],
    right: [['Verified', SNAPSHOT?.verifiedAt ? date(SNAPSHOT.verifiedAt) : null]],
  })

  return doc.render(panel(doc), head.markup, marks, podium, grid, foot.markup)
}

export default {
  name: 'achievements',
  render({ data } = {}) {
    return [{ path: 'assets/generated/trophies.svg', svg: render({ data: data ?? {} }) }]
  },
}
