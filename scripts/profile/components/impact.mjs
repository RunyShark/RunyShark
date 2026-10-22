// Impact — a Vercel Analytics / Observability style KPI board. The shared panel
// toolbar (period + freshness pills), then eight KPI tiles (4×2) framed by grid
// guides and "+" crosshairs. Numbers are the hero; every tile carries one quiet
// micro-visualisation that annotates its own number (monthly area, yearly bars,
// merge meter, repository dot field, streak chain, peak trace, average line,
// weekday bars). Blue is the only data accent; green means "live / growing".

import { profile } from '../content.mjs'
import { compact, date, int, monthLabel, percent } from '../core/format.mjs'
import { glyph } from '../core/glyphs.mjs'
import { card, crosshair, guide, linearGradient, smoothPath, statusDot } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { capHeight, centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'
import { pulseAlong, shineSweep, starfield } from '../core/motion.mjs'
import { PANEL, TYPE, chip as chipShape, freshness, freshnessPill, panelFooter, panelHeader, periodPill } from './shared/panel.mjs'

// ── Layout ────────────────────────────────────────────────────────────────
const W = 860
const GUIDE_L = 32
const GUIDE_R = W - 32
const GRID_TOP = PANEL.toolbar + PANEL.pad // 96
const COLS = 4
const ROWS = 2
const GAP = 16
const TILE_W = (GUIDE_R - GUIDE_L - GAP * (COLS - 1)) / COLS // 187
const TILE_H = 176
const PAD = 20
const INNER = TILE_W - PAD * 2 // 147
const GRID_BOTTOM = GRID_TOP + ROWS * TILE_H + (ROWS - 1) * GAP
const H = GRID_BOTTOM + PANEL.pad + PANEL.footer

// Tile rows (offsets from the tile top).
const LABEL_Y = 28 // eyebrow baseline
const VALUE_Y = 70 // KPI baseline
const NOTE_CY = 93 // footnote / chip centre line
const VIZ_TOP = 116
const VIZ_H = 40

const LABEL = TYPE.eyebrow // 12px mono eyebrow (DESIGN.md rule 3)
const VALUE = { size: 32, weight: 600, tracking: -0.04 }
const UNIT = { size: 14, weight: 500 }
const NOTE = { size: 12, weight: 400 }

const BLUE = { lo: color.blue, hi: color.blueBright }

// Copy content.mjs does not carry.
const COPY = {
  title: 'Impact',
  subtitle: 'GitHub activity across every repository',
  range: 'Last 12 months',
  source: ['Source', 'GitHub GraphQL API · incl. private repositories'],
  window: ['Window', 'Rolling 365 days · UTC'],
}
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Motion (DESIGN.md rule 6, v2): a faint starfield in the frame, a slow blue
// border beam round the panel, a glint along the trend lines and a diagonal
// wave of shine sweeps across the KPI tiles. Every data mark is drawn in its
// final state; motion only adds light.
const MOTION = {
  shinePeriod: 12, // one sweep per tile per loop
  shineStep: 0.55, // s between tile diagonals (col + row)
  beam: { duration: 16, delay: 2.5 },
}

// ── Helpers ───────────────────────────────────────────────────────────────
// Phase so an item starts `at` seconds into a `period` loop (negative delay).
const lag = (at, period) => r2((period - (at % period)) % period)
const r2 = (v) => Math.round(v * 100) / 100
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const arr = (v) => (Array.isArray(v) ? v : [])
const isoDay = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

function hash(a, b = 0, salt = 0) {
  let x = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(salt + 1, 362437)) | 0
  x = Math.imul(x ^ (x >>> 15), 2246822519)
  x = Math.imul(x ^ (x >>> 13), 3266489917)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

function weekdayOf(iso) {
  const d = isoDay(iso)
  return d ? new Date(`${d}T00:00:00Z`).getUTCDay() : null
}

function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many
}

// Footnote date range. The year rides on both ends when the range crosses one
// ("Dec 31, 2023 – Feb 27, 2024") and once at the end when it does not
// ("Mar 2 – Jul 30, 2025"). A cross-year range too wide for the tile falls back
// to apostrophe years ("Dec 31 ’23 – Feb 27 ’24", as on the axis captions).
function dateRange(start, end, maxW = INNER) {
  if (start.slice(0, 4) === end.slice(0, 4)) return `${date(start, { year: false })} – ${date(end)}`
  const full = `${date(start)} – ${date(end)}`
  if (measure(full, NOTE) <= maxW) return full
  const short = (iso) => `${date(iso, { year: false })} ’${iso.slice(2, 4)}`
  return `${short(start)} – ${short(end)}`
}

// Largest font size (≤ base) at which `text` fits `maxW`.
function fitSize(parts, maxW) {
  let size = VALUE.size
  const width = (s) =>
    parts.reduce((sum, p) => sum + measure(p.text, { ...p.opts, size: p.opts === VALUE ? s : p.opts.size }), 0) +
    (parts.length > 1 ? 5 : 0)
  while (size > 20 && width(size) > maxW) size -= 1
  return size
}

// ── Model: derive every tile from the (possibly partial) metrics ─────────
function model(data) {
  const c = data?.contributions ?? {}
  const user = data?.user ?? {}
  const prs = data?.pullRequests ?? {}

  const monthly = arr(c.monthly)
    .filter((m) => num(m?.total) !== null)
    .map((m) => ({ month: typeof m.month === 'string' ? m.month : null, total: m.total }))
  const byYear = arr(c.byYear).filter((y) => num(y?.year) !== null && num(y?.total) !== null)
  const calendar = arr(c.calendar)
    .filter((d) => isoDay(d?.date))
    .map((d) => ({ date: isoDay(d.date), count: Math.max(0, num(d.count) ?? 0), level: num(d.level) }))
  const weekday = arr(c.weekday).map((v) => num(v) ?? 0)

  const firstYear =
    num(byYear[0]?.year) ?? (isoDay(user.createdAt) ? Number(user.createdAt.slice(0, 4)) : null)

  // Streak: the current run when there is one, otherwise the longest on record.
  const current = num(c.currentStreak?.days)
  const longest = num(c.longestStreak?.days)
  const showCurrent = current !== null && (current > 0 || longest === null)

  const busiest =
    num(c.busiestWeekday) !== null && c.busiestWeekday >= 0 && c.busiestWeekday <= 6
      ? c.busiestWeekday
      : weekday.length === 7 && weekday.some((v) => v > 0)
        ? weekday.indexOf(Math.max(...weekday))
        : null
  const weekdayTotal = weekday.reduce((a, b) => a + b, 0)

  const bestDate = isoDay(c.bestDay?.date)
  const bestWd = weekdayOf(bestDate)

  const lastYear = num(c.lastYear)
  const activeDays = num(c.activeDays)
  const windowDays = calendar.length >= 365 ? 365 : calendar.length || 365
  const dailyAverage = num(c.dailyAverage) ?? (lastYear !== null ? lastYear / 365 : null)

  const mergeRate =
    num(prs.mergeRate) ?? (num(prs.merged) !== null && num(prs.total) ? prs.merged / prs.total : null)

  return {
    updated: isoDay(data?.generatedAt),
    lastYear,
    yoy: num(c.yoyGrowth),
    allTime: num(c.allTime),
    firstYear,
    monthly,
    byYear,
    calendar,
    prTotal: num(prs.total),
    prMerged: num(prs.merged),
    mergeRate,
    repos: num(user.totalRepos) ?? (num(user.publicRepos) !== null && num(user.privateRepos) !== null ? user.publicRepos + user.privateRepos : null),
    publicRepos: num(user.publicRepos),
    privateRepos: num(user.privateRepos),
    streak: showCurrent ? current : longest,
    streakKind: showCurrent ? 'current' : longest !== null ? 'longest' : 'current',
    current,
    longest,
    longestRange: [isoDay(c.longestStreak?.start), isoDay(c.longestStreak?.end)],
    bestCount: num(c.bestDay?.count),
    bestDate,
    bestWd,
    dailyAverage,
    activeDays,
    windowDays,
    weekday: weekday.length === 7 ? weekday : [],
    busiest,
    busiestShare: busiest !== null && weekdayTotal > 0 ? weekday[busiest] / weekdayTotal : null,
    busiestTotal: busiest !== null && weekday.length === 7 ? weekday[busiest] : null,
  }
}

// ── Tile chrome ───────────────────────────────────────────────────────────
// Shared chip palette (DESIGN.md rule 5): green only for a positive delta,
// everything else neutral.
function chip(x, cy, text, tone) {
  const c = chipShape({ x, cy, text, tone: tone === 'positive' ? 'positive' : 'neutral' })
  return { width: c.width, markup: c.markup }
}

// Value (+ optional small unit) on the KPI baseline.
function kpi(x, y, value, unit, maxW) {
  const parts = [{ text: value, opts: VALUE }]
  if (unit) parts.push({ text: unit, opts: UNIT })
  const size = fitSize(parts, maxW)
  const muted = value === '—' // a missing number stays readable (#878787), never #454545
  const unitMarkup = unit
    ? `<tspan class="f-sans-500" font-size="${UNIT.size}" letter-spacing="0" fill="${color.textTertiary}" dx="5">${esc(unit)}</tspan>`
    : ''
  return txt(x, y, '', {
    ...VALUE,
    size,
    fill: muted ? color.textTertiary : color.text,
    attrs: { style: 'font-variant-numeric:tabular-nums' },
    content: `${esc(value)}${unitMarkup}`,
  })
}

function footnote(x, cy, { chip: c, text }) {
  const parts = []
  let cx = x
  if (c?.text) {
    const k = chip(cx, cy, c.text, c.tone)
    parts.push(k.markup)
    cx += k.width + 8
  }
  if (text) {
    const room = x + INNER - cx
    parts.push(txt(cx, centerBaseline(cy, NOTE), truncate(text, room, NOTE), { ...NOTE, fill: color.textSecondary }))
  }
  return parts.join('')
}

// Blue lit top edge for the featured tile (brighter at the centre).
function litEdge(doc, x, y, w) {
  const id = linearGradient(doc, 'im-lit-edge', [
    [0, BLUE.hi, 0],
    [0.5, BLUE.hi, 0.85],
    [1, BLUE.hi, 0],
  ], { units: 'userSpaceOnUse', x1: x + 12, y1: 0, x2: x + w - 12, y2: 0 })
  return h('path', { d: `M${x + 24} ${y + 0.5}H${x + w - 24}`, stroke: `url(#${id})`, 'stroke-width': 1 })
}

function tile(doc, i, spec) {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const x = GUIDE_L + col * (TILE_W + GAP)
  const y = GRID_TOP + row * (TILE_H + GAP)
  const cx = x + PAD
  const glyphSize = 14
  const labelRoom = INNER - glyphSize - 10
  const label = truncate(spec.label.toUpperCase(), labelRoom, LABEL)
  const viz = { x: cx, y: y + VIZ_TOP, w: INNER, h: VIZ_H, i }
  return [
    card(doc, {
      x,
      y,
      w: TILE_W,
      h: TILE_H,
      r: 12,
      fill: color.surface,
      stroke: spec.featured ? color.borderStrong : color.border,
      glow: spec.featured ? { color: color.blue, opacity: 0.2, height: 96 } : undefined,
    }),
    spec.featured ? litEdge(doc, x, y, TILE_W) : '',
    shineSweep(doc, {
      x,
      y,
      w: TILE_W,
      h: TILE_H,
      r: 12,
      duration: MOTION.shinePeriod,
      delay: lag((col + row) * MOTION.shineStep, MOTION.shinePeriod),
      opacity: spec.featured ? 0.09 : 0.06,
      band: 96,
    }),
    txt(cx, y + LABEL_Y, label, { ...LABEL, fill: color.textTertiary }),
    glyph(spec.glyph, {
      x: x + TILE_W - PAD - glyphSize,
      y: y + LABEL_Y - capHeight(LABEL) / 2 - glyphSize / 2,
      size: glyphSize,
      stroke: spec.featured ? color.blueBright : color.textTertiary,
      strokeWidth: 1.5,
    }),
    kpi(cx, y + VALUE_Y, spec.value, spec.unit, INNER),
    footnote(cx, y + NOTE_CY, spec.note),
    spec.viz ? spec.viz(doc, viz) : '',
  ].join('')
}

// ── Micro-visualisations ──────────────────────────────────────────────────
// Every viz fills an INNER × VIZ_H box: the graphic sits on a shared floor and
// mono axis captions run along the bottom, so all eight tiles share one rhythm.
const AXIS = { size: 11, family: 'mono', weight: 400, tracking: 0.04 }
const AXIS_H = 15 // caption band under the floor
const REST = '#262626' // resting marks
const REST_HI = '#3a3a3a'

function area(box) {
  return { x: box.x, y: box.y, w: box.w, h: box.h - AXIS_H, floor: box.y + box.h - AXIS_H }
}

// Bottom captions. Plain strings are escaped; { markup } passes tspans through.
function axis(box, left, right, { leftFill = color.textTertiary, rightFill = color.textTertiary } = {}) {
  const y = box.y + box.h
  const one = (x, v, fill, anchor) =>
    v ? txt(x, y, typeof v === 'string' ? v : '', { ...AXIS, fill, anchor, content: typeof v === 'string' ? undefined : v.markup }) : ''
  return one(box.x, left, leftFill) + one(box.x + box.w, right, rightFill, 'end')
}

// Lit marks: a vertical blue ramp that cools and fades toward the floor.
function blueRamp(doc) {
  return linearGradient(doc, 'im-blue-v', [
    [0, BLUE.hi],
    [0.6, BLUE.lo, 0.7],
    [1, BLUE.lo, 0.28],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
}

// Bar with a crisp 1px cap (Vercel charts read by their top edge).
function bar(x, y, w, hh, { lit, ramp } = {}) {
  return [
    h('rect', { x: r2(x), y: r2(y), width: r2(w), height: r2(hh), rx: Math.min(2, w / 2), fill: lit ? `url(#${ramp})` : REST }),
    hh >= 3 ? h('rect', { x: r2(x), y: r2(y), width: r2(w), height: 1, rx: 0.5, fill: lit ? '#cfe6ff' : REST_HI, opacity: lit ? 0.9 : null }) : '',
  ].join('')
}

function emptyViz(box, caption = 'Awaiting data') {
  const a = area(box)
  return [
    guide(a.x, a.floor - 0.5, a.x + a.w, a.floor - 0.5, { stroke: color.borderStrong, dash: '2 3' }),
    axis(box, caption.toUpperCase(), null),
  ].join('')
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16))
  const k = Math.max(0, Math.min(1, t))
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('')}`
}

const monthCap = (iso) => (/^\d{4}-\d{2}/.test(iso ?? '') ? monthLabel(iso).toUpperCase() : null)
const monthYearCap = (iso) => (isoDay(iso) ? `${monthLabel(iso).toUpperCase()} ’${iso.slice(2, 4)}` : null)
// Month-range captions, same rule as dateRange(): year on both ends when the
// range crosses one ("NOV ’25 … OCT ’26"), only on the right end otherwise.
function monthRangeCaps(first, last) {
  const ym = (iso) => /^\d{4}-\d{2}/.test(iso ?? '')
  if (!ym(first) || !ym(last)) return [monthCap(first), monthCap(last)]
  const withYear = (iso) => `${monthCap(iso)} ’${iso.slice(2, 4)}`
  return [first.slice(0, 4) === last.slice(0, 4) ? monthCap(first) : withYear(first), withYear(last)]
}

// 1 · monthly contributions: smooth area + line + live end point.
function vizMonthly(months) {
  return (doc, box) => {
    if (months.length < 2) return emptyViz(box)
    const a = area(box)
    const values = months.map((m) => m.total)
    const max = Math.max(...values, 1)
    const top = a.y + 3
    const base = a.floor
    const step = a.w / (values.length - 1)
    const pts = values.map((v, k) => [r2(a.x + k * step), r2(base - 1 - (v / max) * (base - top - 1))])
    const { line, area: fillPath } = smoothPath(pts, base)
    const fill = linearGradient(doc, 'im-area', [
      [0, BLUE.lo, 0.45],
      [0.75, BLUE.lo, 0.06],
      [1, BLUE.lo, 0],
    ], { units: 'userSpaceOnUse', x1: 0, y1: top, x2: 0, y2: base })
    const stroke = linearGradient(doc, 'im-line', [
      [0, BLUE.lo, 0.6],
      [1, BLUE.hi],
    ], { units: 'userSpaceOnUse', x1: a.x, y1: 0, x2: a.x + a.w, y2: 0 })
    const [ex, ey] = pts[pts.length - 1]
    return [
      guide(a.x, base - 0.5, a.x + a.w, base - 0.5, { stroke: color.border }),
      h('path', { d: fillPath, fill: `url(#${fill})` }),
      h('path', { d: line, stroke: `url(#${stroke})`, 'stroke-width': 1.75, 'stroke-linecap': 'round' }),
      // Signature motion: a light glint travelling along the trend line.
      pulseAlong(doc, { d: line, color: '#d6ebff', duration: 6.5, delay: 1.2, length: 20, width: 1.75, rest: 0.3 }),
      statusDot(doc, ex, ey, { fill: BLUE.hi, r: 2.5, pulse: false }),
      axis(box, ...monthRangeCaps(months[0].month, months[months.length - 1].month), { rightFill: color.textSecondary }),
    ].join('')
  }
}

// 2 · contributions per year: bars, the current year lit.
function vizYears(byYear) {
  return (doc, box) => {
    if (!byYear.length) return emptyViz(box)
    const a = area(box)
    const years = byYear.slice(-8)
    const n = years.length
    const bw = Math.min(14, (a.w - 8 * (n - 1)) / n)
    const pitch = n > 1 ? (a.w - bw) / (n - 1) : 0
    const max = Math.max(...years.map((y) => y.total), 1)
    const ramp = blueRamp(doc)
    const bars = years.map((y, k) => {
      const hh = Math.max(2, (y.total / max) * a.h)
      return bar(a.x + k * pitch, a.floor - hh, bw, hh, { lit: k === n - 1, ramp })
    })
    return [
      bars.join(''),
      axis(box, String(years[0].year), n > 1 ? String(years[n - 1].year) : null, { rightFill: color.textSecondary }),
    ].join('')
  }
}

// 3 · merge rate: segmented meter.
function vizMeter(ratio, merged, total) {
  return (doc, box) => {
    if (ratio === null) return emptyViz(box)
    const a = area(box)
    const n = 32
    const gap = 2
    const sw = (a.w - gap * (n - 1)) / n
    const on = Math.round(Math.max(0, Math.min(1, ratio)) * n)
    const segH = Math.min(18, a.h)
    const ramp = blueRamp(doc)
    const segs = Array.from({ length: n }, (_, k) => bar(a.x + k * (sw + gap), a.floor - segH, sw, segH, { lit: k < on, ramp }))
    return [
      segs.join(''),
      axis(box, 'MERGED', merged !== null ? int(merged) : total !== null ? `OF ${int(total)}` : null, {
        rightFill: color.textSecondary,
      }),
    ].join('')
  }
}

// 4 · repositories: one dot per repository (public = white, private = blue).
function vizRepos(total, pub, priv) {
  return (doc, box) => {
    if (total === null || total <= 0) return emptyViz(box)
    const a = area(box)
    const pitch = 3.6
    const cols = Math.floor(a.w / pitch)
    const rows = Math.floor(a.h / pitch)
    const slots = cols * rows
    const per = Math.max(1, Math.ceil(total / slots))
    const filled = Math.ceil(total / per)
    const pubDots = pub !== null ? Math.min(filled, Math.round(pub / per)) : 0
    const split = pub !== null || priv !== null
    const ox = a.x + (a.w - cols * pitch) / 2
    const oy = a.floor - rows * pitch
    const dots = []
    for (let k = 0; k < slots; k++) {
      const c = Math.floor(k / rows)
      const r = k % rows
      const cx = r2(ox + c * pitch + pitch / 2)
      const cy = r2(oy + r * pitch + pitch / 2)
      const n = hash(c, r, 41)
      if (k < pubDots) {
        dots.push(h('circle', { cx, cy, r: r2(1.15 + n * 0.2), fill: color.text, opacity: r2(0.82 + n * 0.18) }))
      } else if (k < filled) {
        // pixelated-canvas texture: per-dot jitter in size, tone and opacity
        const tone = n < 0.16 ? BLUE.hi : n < 0.72 ? '#2f8af5' : '#0b58b8'
        dots.push(h('circle', { cx, cy, r: r2(0.95 + n * 0.3), fill: tone, opacity: r2(0.55 + n * 0.4) }))
      } else {
        dots.push(h('circle', { cx, cy, r: 0.8, fill: REST_HI, opacity: 0.6 }))
      }
    }
    // Legend swatches are drawn (U+25CF is not in the embedded Geist subset).
    const capY = box.y + box.h
    const swatchY = r2(capY - capHeight(AXIS) / 2)
    const privLabel = 'PRIVATE'
    const privX = box.x + box.w - measure(privLabel, AXIS)
    return [
      dots.join(''),
      split
        ? [
            h('circle', { cx: box.x + 2.5, cy: swatchY, r: 2.5, fill: color.text }),
            txt(box.x + 10, capY, 'PUBLIC', { ...AXIS, fill: color.textTertiary }),
            h('circle', { cx: r2(privX - 8), cy: swatchY, r: 2.5, fill: '#2f8af5' }),
            txt(box.x + box.w, capY, privLabel, { ...AXIS, anchor: 'end', fill: color.textTertiary }),
          ].join('')
        : axis(box, per > 1 ? `1 DOT = ${per} REPOS` : '1 DOT = 1 REPO', null),
    ].join('')
  }
}

// 5 · recent-days chain under the streak KPI: the last 21 days, consecutive
// active days linked (captioned "LAST 21 DAYS" so it never reads as the streak itself).
function vizStreak(calendar) {
  return (doc, box) => {
    const n = 21
    const days = calendar.slice(-n)
    if (!days.length) return emptyViz(box)
    const a = area(box)
    const pitch = a.w / n
    const cy = r2(a.y + a.h / 2 + 2)
    const xs = days.map((_, k) => r2(a.x + (n - days.length + k) * pitch + pitch / 2))
    const peak = Math.max(...days.map((d) => d.count), 1)
    const links = []
    for (let k = 1; k < days.length; k++) {
      if (days[k].count > 0 && days[k - 1].count > 0) links.push(`M${xs[k - 1]} ${cy}H${xs[k]}`)
    }
    const dots = days.map((d, k) => {
      if (d.count <= 0) return h('circle', { cx: xs[k], cy, r: 2.3, fill: color.bg, stroke: REST_HI, 'stroke-width': 1 })
      const t = Math.sqrt(d.count / peak)
      return h('circle', { cx: xs[k], cy, r: r2(2.2 + t * 0.9), fill: mixHex('#0b4a9e', '#a8d1ff', t) })
    })
    const lastX = xs[xs.length - 1]
    return [
      links.length ? h('path', { d: links.join(''), stroke: '#1d5fb8', 'stroke-width': 1.25, opacity: 0.75 }) : '',
      dots.join(''),
      h('circle', { cx: lastX, cy, r: 6, stroke: color.borderHover, 'stroke-width': 1, 'stroke-dasharray': '2 2' }),
      axis(box, `LAST ${n} DAYS`, 'TODAY', { rightFill: color.textSecondary }),
    ].join('')
  }
}

// 6 · daily trace with the peak day marked.
function vizPeak(calendar, bestDate) {
  return (doc, box) => {
    if (calendar.length < 2) return emptyViz(box)
    const a = area(box)
    const max = Math.max(...calendar.map((d) => d.count), 1)
    const step = a.w / (calendar.length - 1)
    const base = a.floor
    const yOf = (v) => r2(base - 0.75 - (v / max) * (a.h - 4))
    let peak = calendar.findIndex((d) => d.date === bestDate)
    if (peak < 0) peak = calendar.findIndex((d) => d.count === max)
    const d = calendar.map((p, k) => `${k ? 'L' : 'M'}${r2(a.x + k * step)} ${yOf(p.count)}`).join('')
    const px = r2(a.x + peak * step)
    const py = yOf(calendar[peak].count)
    const fill = linearGradient(doc, 'im-trace', [
      [0, '#ffffff', 0.12],
      [1, '#ffffff', 0],
    ], { units: 'userSpaceOnUse', x1: 0, y1: a.y, x2: 0, y2: base })
    return [
      h('path', { d: `${d}L${r2(a.x + a.w)} ${base}L${a.x} ${base}Z`, fill: `url(#${fill})` }),
      h('path', { d, stroke: '#5a5a5a', 'stroke-width': 1, 'stroke-linejoin': 'round' }),
      pulseAlong(doc, { d, color: '#ffffff', duration: 9, delay: 4.1, length: 9, width: 1, rest: 0.35, opacity: 0.55 }),
      guide(px, py + 4, px, base, { stroke: BLUE.hi, dash: '1 2', opacity: 0.8 }),
      h('circle', { cx: px, cy: py, r: 5.5, fill: BLUE.lo, opacity: 0.22 }),
      h('circle', { cx: px, cy: py, r: 2.5, fill: BLUE.hi, stroke: color.surface, 'stroke-width': 1 }),
      axis(box, monthYearCap(calendar[0].date), monthYearCap(calendar[calendar.length - 1].date)),
    ].join('')
  }
}

// 7 · weekly totals with the daily-average reference line.
function vizAverage(calendar, dailyAverage) {
  return (doc, box) => {
    if (calendar.length < 7) return emptyViz(box)
    const a = area(box)
    const weeks = []
    for (let k = 0; k < calendar.length; k += 7) weeks.push(calendar.slice(k, k + 7).reduce((s, d) => s + d.count, 0))
    const n = weeks.length
    const pitch = a.w / n
    const bw = Math.max(1, pitch - 1)
    const max = Math.max(...weeks, 1)
    const avgWeek = dailyAverage !== null ? dailyAverage * 7 : null
    const bars = weeks.map((v, k) => {
      const hh = Math.max(1, (v / max) * a.h)
      const above = avgWeek !== null && v >= avgWeek
      return h('rect', { x: r2(a.x + k * pitch), y: r2(a.floor - hh), width: r2(bw), height: r2(hh), fill: above ? '#4a4a4a' : REST })
    })
    const parts = [bars.join('')]
    let legend = null
    if (avgWeek !== null && avgWeek <= max) {
      const ay = r2(a.floor - (avgWeek / max) * a.h) + 0.5
      parts.push(h('path', { d: `M${a.x} ${ay}H${a.x + a.w}`, stroke: BLUE.hi, 'stroke-width': 1, 'stroke-dasharray': '3 2' }))
      legend = { markup: `<tspan fill="${BLUE.hi}">--</tspan><tspan dx="4">AVG</tspan>` }
    }
    parts.push(axis(box, `${n} WEEKS`, legend, { rightFill: color.textSecondary }))
    return parts.join('')
  }
}

// 8 · contributions by weekday, busiest lit, with initials.
function vizWeekdays(weekday, busiest) {
  return (doc, box) => {
    if (weekday.length !== 7) return emptyViz(box)
    const a = area(box)
    const gap = 7
    const bw = (a.w - gap * 6) / 7
    const max = Math.max(...weekday, 1)
    const ramp = blueRamp(doc)
    return weekday
      .map((v, k) => {
        const hh = Math.max(2, (v / max) * a.h)
        const x = a.x + k * (bw + gap)
        const on = k === busiest
        return [
          bar(x, a.floor - hh, bw, hh, { lit: on, ramp }),
          txt(r2(x + bw / 2), box.y + box.h, WEEKDAY_SHORT[k].charAt(0), {
            ...AXIS,
            anchor: 'middle',
            fill: on ? color.text : color.textTertiary,
          }),
        ].join('')
      })
      .join('')
  }
}

// ── Tiles ─────────────────────────────────────────────────────────────────
function tiles(m) {
  const growth = m.yoy !== null ? percent(m.yoy, { signed: true }) : null
  const repoSplit =
    m.publicRepos !== null && m.privateRepos !== null
      ? `${int(m.publicRepos)} public · ${int(m.privateRepos)} private`
      : m.publicRepos !== null
        ? `${int(m.publicRepos)} public`
        : 'Public & private'
  const streakNote =
    m.streakKind === 'current'
      ? m.longest !== null
        ? `Longest ${int(m.longest)} ${plural(m.longest, 'day')}`
        : 'Consecutive active days'
      : m.longestRange[0] && m.longestRange[1]
        ? dateRange(m.longestRange[0], m.longestRange[1])
        : 'Consecutive active days'
  const bestNote = m.bestDate
    ? `${m.bestWd !== null ? `${WEEKDAY_SHORT[m.bestWd]}, ` : ''}${date(m.bestDate)}`
    : 'Single-day record'
  const activeNote = m.activeDays !== null ? `${int(m.activeDays)} of ${int(m.windowDays)} days active` : 'Per calendar day'

  return [
    {
      label: 'Contributions',
      glyph: 'activity',
      featured: true,
      value: compact(m.lastYear),
      note: {
        chip: growth && m.yoy !== 0 ? { text: growth, tone: m.yoy > 0 ? 'positive' : 'neutral' } : null,
        text: growth ? 'vs. prior year' : 'Last 12 months',
      },
      viz: vizMonthly(m.monthly),
    },
    {
      label: 'All-time',
      glyph: 'layers',
      value: compact(m.allTime),
      note: { text: m.firstYear ? `Contributions since ${m.firstYear}` : 'Contributions' },
      viz: vizYears(m.byYear),
    },
    {
      label: 'Pull requests',
      glyph: 'gitPullRequest',
      value: compact(m.prTotal),
      note: {
        chip: m.mergeRate !== null ? { text: percent(m.mergeRate), tone: 'neutral' } : null,
        text: m.mergeRate !== null ? 'merge rate' : 'Opened on GitHub',
      },
      viz: vizMeter(m.mergeRate, m.prMerged, m.prTotal),
    },
    {
      label: 'Repositories',
      glyph: 'folder',
      value: compact(m.repos),
      note: { text: repoSplit },
      viz: vizRepos(m.repos, m.publicRepos, m.privateRepos),
    },
    {
      label: m.streakKind === 'current' ? 'Current streak' : 'Longest streak',
      glyph: 'flame',
      value: int(m.streak),
      unit: m.streak !== null ? plural(m.streak, 'day') : null,
      note: { text: streakNote },
      viz: vizStreak(m.calendar),
    },
    {
      label: 'Busiest day',
      glyph: 'zap',
      value: compact(m.bestCount),
      note: { text: bestNote },
      viz: vizPeak(m.calendar, m.bestDate),
    },
    {
      label: 'Daily average',
      glyph: 'gauge',
      value: int(m.dailyAverage),
      unit: m.dailyAverage !== null ? '/ day' : null,
      note: { text: activeNote },
      viz: vizAverage(m.calendar, m.dailyAverage),
    },
    {
      label: 'Top weekday',
      glyph: 'calendar',
      value: m.busiest !== null ? WEEKDAY_NAMES[m.busiest] : '—',
      note: {
        chip: m.busiestShare !== null ? { text: percent(m.busiestShare), tone: 'neutral' } : null,
        text: m.busiestShare !== null ? 'of yearly activity' : 'Most productive day',
      },
      viz: vizWeekdays(m.weekday, m.busiest),
    },
  ]
}

// ── Frame ─────────────────────────────────────────────────────────────────
// Shared toolbar (DESIGN.md rule 1): GitHub tile, title, period + freshness pills.
// Freshness is the github source's real state (rule 7), never a hard-coded "Live".
function header(doc, data) {
  return panelHeader(doc, {
    icon: { brand: 'github' },
    title: COPY.title,
    subtitle: COPY.subtitle,
    pills: [periodPill(COPY.range), freshnessPill(freshness(data, 'github'))],
  }).markup
}

// Vercel grid scaffolding between toolbar and footer: dashed guides on the tile
// edges, "+" where they cross.
function frame() {
  const xs = [GUIDE_L + 0.5, GUIDE_R - 0.5]
  const ys = [GRID_TOP - 0.5, GRID_BOTTOM + 0.5]
  return [
    ...xs.map((x) => guide(x, PANEL.toolbar, x, H - PANEL.footer, { dash: '2 4', opacity: 0.9 })),
    ...ys.map((y) => guide(0, y, W, y, { dash: '2 4', opacity: 0.9 })),
    ...xs.flatMap((x) => ys.map((y) => crosshair(x, y, { size: 13, stroke: color.borderHover }))),
  ].join('')
}

// Provenance strip (rule 4).
function footer(doc) {
  return panelFooter(doc, { y: H - PANEL.footer, left: [COPY.source], right: [COPY.window] }).markup
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

function describe(m) {
  const bits = [
    m.lastYear !== null && `${int(m.lastYear)} contributions in the last 12 months${m.yoy !== null ? ` (${percent(m.yoy, { signed: true })} year over year)` : ''}`,
    m.allTime !== null && `${int(m.allTime)} all-time${m.firstYear ? ` since ${m.firstYear}` : ''}`,
    m.prTotal !== null && `${int(m.prTotal)} pull requests${m.mergeRate !== null ? ` (${percent(m.mergeRate)} merged)` : ''}`,
    m.repos !== null && `${int(m.repos)} repositories`,
    m.streak !== null && `${m.streakKind} streak ${int(m.streak)} days`,
    m.bestCount !== null && `busiest day ${int(m.bestCount)} contributions${m.bestDate ? ` on ${date(m.bestDate)}` : ''}`,
    m.dailyAverage !== null && `${int(m.dailyAverage)} contributions per day on average`,
    m.busiest !== null && `most productive on ${WEEKDAY_NAMES[m.busiest]}s`,
  ].filter(Boolean)
  return bits.length ? `GitHub impact: ${bits.join('; ')}.` : 'GitHub impact dashboard.'
}

// Ambient sky: stars only where the frame shows (header, gutters, footer).
function sky(doc) {
  const tilesBox = { x: GUIDE_L - 2, y: GRID_TOP - 2, w: GUIDE_R - GUIDE_L + 4, h: GRID_BOTTOM - GRID_TOP + 4 }
  const textBoxes = [
    { x: 24, y: 10, w: 330, h: PANEL.toolbar - 20 }, // tile + title + subtitle
    { x: W - 440, y: 10, w: 416, h: PANEL.toolbar - 20 }, // pills
    { x: 0, y: H - PANEL.footer - 2, w: W, h: PANEL.footer + 2 }, // footer strip
  ]
  const avoid = [...textBoxes]
  // keep the 16px gutters between tiles open, block the tiles themselves
  for (let i = 0; i < COLS * ROWS; i++) {
    const x = GUIDE_L + (i % COLS) * (TILE_W + GAP)
    const y = GRID_TOP + Math.floor(i / COLS) * (TILE_H + GAP)
    avoid.push({ x: x + 4, y: y + 4, w: TILE_W - 8, h: TILE_H - 8 })
  }
  return [
    starfield(doc, { x: 6, y: 6, w: W - 12, h: H - 12, count: 110, seed: 'impact', twinkle: 0.55, avoid, opacity: 0.75 }),
    // the open toolbar band between title and pills: brighter stars + a flare
    starfield(doc, { x: 356, y: 8, w: 60, h: PANEL.toolbar - 16, count: 8, seed: 'impact-head', flares: 1, avoid: [tilesBox], opacity: 0.9 }),
  ]
}

function render({ data }) {
  const m = model(data)
  const doc = createDoc({ width: W, height: H, title: `${profile.login ?? 'RunyShark'} — Impact`, desc: describe(m) })
  const clip = panelClip(doc)
  const specs = tiles(m)
  return doc.render(
    panel(doc),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      sky(doc),
      frame(),
      specs.map((spec, i) => tile(doc, i, spec)),
    ),
    header(doc, data),
    footer(doc),
    beam(doc, { x: 0, y: 0, w: W, h: H, r: 16, color: BLUE.hi, duration: MOTION.beam.duration, delay: MOTION.beam.delay, length: 70, width: 1.25 }),
  )
}

export default {
  name: 'impact',
  render({ data } = {}) {
    return [{ path: 'assets/generated/impact.svg', svg: render({ data: data ?? {} }) }]
  },
}
