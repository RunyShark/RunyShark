// Contribution activity — a Vercel Analytics page drawn in one SVG.
//
//   ┌ ▣ Contribution activity ──────────────── [▣ Oct 19, 2025 – Oct 22, 2026] [● Live] ┐
//   │ 44,771 contributions in the last year   (KPI statement, 20px) · subline            │
//   ├ CONTRIBUTION GRAPH ─────────────────────────────────────────── Less ▪▪▪▪▪ More ──┤
//   │      Nov   Dec   Jan  …  53 Sunday-aligned weeks on the blue heat scale            │
//   ├ MONTHLY TREND ──────────────────────────────────────────────── 3,684 avg / month ──┤
//   │  y ticks │ glowing line · halftone area · frozen-hover tooltip on the peak · live dot │
//   ├ BY WEEKDAY ──────────────────────────┼ BY YEAR ─────────────── ↗ 20× since 2022 ──┤
//   │  "top pages" rows, busiest in blue    │  columns 2021 → now, current year = YTD     │
//   └───────────────────────────────────────┴─────────────────────────────────────────────┘
//
// Data: data.contributions (DESIGN.md §6). Every block degrades on its own when
// its field is missing: empty grid, bare gridlines + "No data yet", "—".
// Motion is ambient and never hides data (DESIGN.md rule 6, v2): a starfield in
// the header, a slow border beam, a diagonal wave of light across the heatmap
// (an overlay that rests at opacity 0, so every cell shows its true level at
// rest), a glint along the trend line, shine on the lit bars and a pulse on the
// current month. No SVG filters: an <img> SVG is re-rasterised on every animation
// frame, so every glow is a gradient or a stack of faint strokes instead.
// There is deliberately no hide→show reveal —
// headless Chrome freezes <img> SVG timelines near t=0, and any renderer that
// does the same would publish an empty chart.

import { compact, date, int, monthLabel } from '../core/format.mjs'
import { resolveFont } from '../core/fonts.mjs'
import { glyph } from '../core/glyphs.mjs'
import { crosshair, linearGradient, radialGradient, smoothPath } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { capHeight, centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color, heat, layout } from '../core/tokens.mjs'
import { pulseAlong, shineSweep, starfield } from '../core/motion.mjs'
import { PANEL, TYPE, freshness, freshnessPill, panelHeader, periodPill } from './shared/panel.mjs'

// ── copy that content.mjs does not carry ────────────────────────────────────
const COPY = {
  title: 'Contribution activity',
  subtitle: 'Every contribution on GitHub, day by day',
  headTail: ' in the last year',
  headFallback: 'Contributions',
  headFallbackTail: ' over the last year',
  graph: 'Contribution graph',
  trend: 'Monthly trend',
  weekday: 'By weekday',
  year: 'By year',
  less: 'Less',
  more: 'More',
  ytd: 'YTD',
  empty: 'No data yet',
  activeDays: 'active days',
  perDay: 'per day',
  peak: 'peak of',
  avgMonth: ' avg / month',
  since: 'since',
  busiest: 'Busiest',
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── geometry ────────────────────────────────────────────────────────────────
const W = layout.width
const PAD = layout.pad // 32
const X1 = W - PAD
const INNER = X1 - PAD // 796
const TOOLBAR = PANEL.toolbar // 64
const HEADER_H = TOOLBAR + 96 // toolbar + KPI statement band
const STATEMENT_Y = TOOLBAR + 44 // statement baseline
const SUBLINE_Y = TOOLBAR + 69
const LABEL_DY = 40 // section top → eyebrow baseline

// A — heatmap: 53 columns fill the padding box exactly (fractional pitch is
// fine: GitHub scales the 860px image to its column anyway).
const COLS = 53
const DAY_COL = 32 // Mon/Wed/Fri gutter
const GAP = 3
const PITCH = (INNER - DAY_COL + GAP) / COLS
const CELL = PITCH - GAP
const CELL_R = 2.5
const GRID_X = PAD + DAY_COL
const GRID_H = 7 * PITCH - GAP
const A_MONTH_DY = 68
const A_GRID_DY = 80
const A_H = Math.round(A_GRID_DY + GRID_H + 30)

// B — monthly trend
const B_PLOT_DY = 88
const TIP_ROOM = 34 // tooltip headroom above the plot
const DOT_PITCH = 4
const B_PLOT_H = 140
const B_H = B_PLOT_DY + B_PLOT_H + 22 + 30

// C/D — weekday rows | year columns
const COL = W / 2
const GUTTER = 24
const R_CONTENT_DY = 64
const ROW_H = 26
const ROW_GAP = 6
const ROWS_H = 7 * ROW_H + 6 * ROW_GAP
const R_H = R_CONTENT_DY + ROWS_H + 30

// Heatmap wave: overlay tint per level (brighter days catch more light).
const WAVE = { period: 10, step: 0.075, color: '#cfe6ff', lift: [0.1, 0.24, 0.3, 0.34, 0.4] }
const BEAM = { duration: 18, delay: 9 }

const MONO_LABEL = { size: 12, weight: 400, family: 'mono', tracking: 0.08 }
const MONO_TICK = { size: 11, weight: 400, family: 'mono' }
const TAB = { style: 'font-variant-numeric:tabular-nums' }

// ── helpers ─────────────────────────────────────────────────────────────────
const r2 = (v) => Math.round(v * 100) / 100
// Phase (s) so an item peaks `at` seconds into a `period` loop.
const lagOf = (at, period) => r2((period - (at % period)) % period)
const phaseStyle = (sec) => (sec ? `animation-delay:-${sec}s` : null)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const nonNeg = (v) => (isNum(v) && v > 0 ? v : 0)
const DAY_MS = 86400000

function dayNum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(t) ? Math.round(t / DAY_MS) : null
}
const weekdayOf = (t) => (((t + 4) % 7) + 7) % 7 // 1970-01-01 was a Thursday
const isoOf = (t) => new Date(t * DAY_MS).toISOString().slice(0, 10)

// 2500 → "2.5K", 10000 → "10K"
function tick(v) {
  if (!v) return '0'
  if (v >= 1_000_000) return `${r2(v / 1_000_000)}M`
  if (v >= 1000) return `${r2(v / 1000)}K`
  return String(r2(v))
}

function niceScale(max, count = 4) {
  if (!(max > 0)) return { step: 1, top: count }
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  return { step, top: Math.ceil(max / step - 1e-9) * step }
}

function plural(n, one, many) {
  return n === 1 ? one : many
}

// One <text> of mixed styles ([[text, style], …]) ending at `x`. Tspans keep the
// inner spaces that separate <text> elements would strip.
function tspan(text, { size = 14, weight = 400, family = 'sans', fill = color.text, tracking } = {}) {
  return h(
    'tspan',
    { class: `f-${resolveFont(family, weight)}`, 'font-size': size, fill, 'letter-spacing': tracking ? `${tracking}em` : null },
    esc(text),
  )
}
function runWidth(parts) {
  return parts.reduce((n, [text, style]) => n + measure(text, style), 0)
}
function rightRun(x, y, parts) {
  const [, first] = parts[0]
  return txt(x, y, '', { ...first, anchor: 'end', attrs: TAB, content: parts.map(([text, style]) => tspan(text, style)).join('') })
}

// Mono eyebrow over each block. No index: numbers belong to section headers only.
function sectionLabel(x, y, text) {
  return txt(x, y, text.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary })
}

// "No data yet" on a black plate, so gridlines never strike through it.
function emptyNote(cx, cy) {
  const S = { size: 13 }
  const w = Math.ceil(measure(COPY.empty, S) + 24)
  return [
    h('rect', { x: r2(cx - w / 2), y: r2(cy - 13), width: w, height: 26, rx: 6, fill: color.bg }),
    txt(r2(cx), r2(centerBaseline(cy, S)), COPY.empty, { ...S, fill: color.textTertiary, anchor: 'middle' }),
  ]
}

// Rect with only the top corners rounded (column bars sit on a baseline).
function topRounded(x, y, w, hgt, r) {
  const rr = Math.max(0, Math.min(r, w / 2, hgt))
  return `M${r2(x)} ${r2(y + hgt)}V${r2(y + rr)}Q${r2(x)} ${r2(y)} ${r2(x + rr)} ${r2(y)}H${r2(x + w - rr)}Q${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + rr)}V${r2(y + hgt)}Z`
}

// ── data model ──────────────────────────────────────────────────────────────
function model(data) {
  const c = data?.contributions ?? {}

  const seen = new Set()
  const days = (Array.isArray(c.calendar) ? c.calendar : [])
    .map((d) => ({ t: dayNum(d?.date), count: nonNeg(d?.count), level: d?.level }))
    .filter((d) => d.t !== null && !seen.has(d.t) && seen.add(d.t))
    .sort((a, b) => a.t - b.t)

  // Levels come from GitHub; derive quartiles only when they are missing.
  const nz = days.map((d) => d.count).filter((n) => n > 0).sort((a, b) => a - b)
  const q = (p) => (nz.length ? nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] : 0)
  const cut = [q(0.25), q(0.5), q(0.75)]
  for (const d of days) {
    if (Number.isInteger(d.level) && d.level >= 0 && d.level <= 4) continue
    d.level = d.count <= 0 ? 0 : d.count <= cut[0] ? 1 : d.count <= cut[1] ? 2 : d.count <= cut[2] ? 3 : 4
  }

  const calSum = days.reduce((n, d) => n + d.count, 0)
  const lastYear = isNum(c.lastYear) ? c.lastYear : days.length ? calSum : null
  const activeDays = isNum(c.activeDays) ? c.activeDays : days.length ? days.filter((d) => d.count > 0).length : null
  const dailyAverage = isNum(c.dailyAverage) ? c.dailyAverage : null
  const bestDay = isNum(c.bestDay?.count) && dayNum(c.bestDay?.date) !== null ? c.bestDay : null

  const monthly = (Array.isArray(c.monthly) ? c.monthly : [])
    .filter((m) => /^\d{4}-\d{2}/.test(String(m?.month ?? '')))
    .map((m) => ({ month: String(m.month).slice(0, 7), total: nonNeg(m.total) }))
    .slice(-12)

  const hasWeekday = Array.isArray(c.weekday) && c.weekday.some(isNum)
  const weekday = Array.from({ length: 7 }, (_, i) => (hasWeekday && isNum(c.weekday[i]) ? Math.max(0, c.weekday[i]) : null))

  const years = new Map()
  for (const y of Array.isArray(c.byYear) ? c.byYear : []) {
    if (Number.isInteger(y?.year) && y.year > 1990 && y.year < 3000) years.set(y.year, nonNeg(y.total))
  }
  const byYear = [...years.entries()].map(([year, total]) => ({ year, total })).sort((a, b) => a.year - b.year).slice(-8)

  // "Today" for YTD: the calendar's last day, else the snapshot timestamp.
  const refDay = days.length ? days.at(-1).t : dayNum(data?.generatedAt)

  return { days, lastYear, activeDays, dailyAverage, bestDay, monthly, weekday, hasWeekday, byYear, refDay }
}

// ── header ──────────────────────────────────────────────────────────────────
// Shared toolbar (DESIGN.md rule 1) with the window as a period pill and the
// github source's real freshness, then one KPI statement (rule 1: 18–20px, the
// section header above is the headline) and its subline.
function header(doc, m, data) {
  const headStyle = { ...TYPE.statement, size: 20 }
  const n = m.lastYear
  const head1 = isNum(n) ? `${int(n)} ${plural(Math.round(n), 'contribution', 'contributions')}` : COPY.headFallback
  const head2 = isNum(n) ? COPY.headTail : COPY.headFallbackTail
  const headline = txt(PAD, STATEMENT_Y, '', {
    ...headStyle,
    attrs: TAB,
    content: `${h('tspan', { fill: color.text }, esc(head1))}${h('tspan', { fill: color.textTertiary }, esc(head2))}`,
  })

  const sub = []
  if (isNum(m.activeDays)) sub.push(`${int(m.activeDays)} ${COPY.activeDays}`)
  if (isNum(m.dailyAverage)) sub.push(`${m.dailyAverage.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${COPY.perDay}`)
  if (m.bestDay) sub.push(`${COPY.peak} ${int(m.bestDay.count)} on ${date(m.bestDay.date)}`)
  const SUB = { size: 13 }

  const range = m.days.length ? `${date(isoOf(m.days[0].t))} – ${date(isoOf(m.days.at(-1).t))}` : null
  const toolbar = panelHeader(doc, {
    icon: { glyph: 'activity' },
    title: COPY.title,
    subtitle: COPY.subtitle,
    pills: [range ? periodPill(range) : null, freshnessPill(freshness(data, 'github'))],
  })

  // atmosphere on the right of the statement band: amber light from the top edge,
  // a faint 24px grid fading out, and a starfield kept off the copy and the pills
  const focusX = W - 220
  const focusY = (TOOLBAR + HEADER_H) / 2
  const glow = radialGradient(doc, 'act-glow', [
    [0, color.amber, 0.12],
    [0.45, color.amber, 0.03],
    [1, color.amber, 0],
  ])
  doc.def(
    'act-hdr-grid',
    h(
      'pattern',
      { id: 'act-hdr-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse', x: PAD % 24, y: HEADER_H % 24 },
      h('path', { d: 'M0.5 0V24M0 0.5H24', stroke: '#ffffff', 'stroke-opacity': 0.07 }),
    ),
  )
  const fade = radialGradient(doc, 'act-hdr-fade', [
    [0, '#ffffff', 1],
    [0.6, '#ffffff', 0.35],
    [1, '#ffffff', 0],
  ])
  doc.def(
    'act-hdr-mask',
    h(
      'mask',
      { id: 'act-hdr-mask', maskUnits: 'userSpaceOnUse', x: 0, y: TOOLBAR, width: W, height: HEADER_H - TOOLBAR },
      h('ellipse', { cx: focusX, cy: focusY, rx: 280, ry: 90, fill: `url(#${fade})` }),
    ),
  )
  const edge = linearGradient(doc, 'act-edge', [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', 0.24],
    [1, '#ffffff', 0],
  ], { units: 'userSpaceOnUse', x1: 16, y1: 0, x2: W - 16, y2: 0 })

  const headW = Math.max(measure(head1 + head2, headStyle), sub.length ? measure(sub.join('  ·  '), SUB) : 0)
  const stars = starfield(doc, {
    x: 8,
    y: TOOLBAR + 4,
    w: W - 16,
    h: HEADER_H - TOOLBAR - 8,
    count: 56,
    seed: 'activity',
    flares: 2,
    twinkle: 0.6,
    opacity: 0.8,
    avoid: [{ x: PAD - 6, y: TOOLBAR + 18, w: Math.min(INNER, headW) + 16, h: SUBLINE_Y - TOOLBAR - 6 }],
  })

  return {
    back: [
      h('ellipse', { cx: focusX, cy: 0, rx: 340, ry: 170, fill: `url(#${glow})` }),
      stars,
      h('rect', { x: 0, y: TOOLBAR, width: W, height: HEADER_H - TOOLBAR, fill: 'url(#act-hdr-grid)', mask: 'url(#act-hdr-mask)' }),
      h('path', { d: `M16 0.5H${W - 16}`, stroke: `url(#${edge})` }),
    ],
    front: [
      toolbar.markup,
      headline,
      sub.length ? txt(PAD, SUBLINE_Y, truncate(sub.join('  ·  '), INNER, SUB), { ...SUB, fill: color.textSecondary, attrs: TAB }) : '',
    ],
  }
}

// ── A · heatmap ─────────────────────────────────────────────────────────────
function heatmap(doc, m, top) {
  const labelY = top + LABEL_DY
  const gridY = top + A_GRID_DY
  const byDay = new Map(m.days.map((d) => [d.t, d]))
  const last = m.days.length ? m.days.at(-1).t : null
  const start = last === null ? null : last - weekdayOf(last) - (COLS - 1) * 7
  const cx = (col) => GRID_X + col * PITCH
  const cy = (row) => gridY + row * PITCH

  const columns = []
  const hot = []
  const waves = new Map() // diagonal (col + row) → overlay cells
  // best day: a thin white ring, the heatmap's "selected" cell
  const bestT = m.bestDay ? dayNum(m.bestDay.date) : null
  let ring = ''
  for (let col = 0; col < COLS; col++) {
    const cells = []
    for (let row = 0; row < 7; row++) {
      const t = start === null ? null : start + col * 7 + row
      if (t !== null && t > last) continue
      const level = t === null ? 0 : (byDay.get(t)?.level ?? 0)
      const rect = { x: r2(cx(col)), y: r2(cy(row)), width: r2(CELL), height: r2(CELL), rx: CELL_R }
      cells.push(h('rect', { ...rect, fill: heat[level] ?? heat[0] }))
      if (t !== null) {
        const d = col + row
        if (!waves.has(d)) waves.set(d, [])
        waves.get(d).push(h('rect', { ...rect, 'fill-opacity': WAVE.lift[level] ?? WAVE.lift[0] }))
      }
      // hot days get a soft halo: a pre-blurred radial gradient, not a filter
      if (level >= 3) {
        const pad = level === 4 ? 6 : 4
        hot.push(h('rect', { x: r2(cx(col) - pad), y: r2(cy(row) - pad), width: r2(CELL + pad * 2), height: r2(CELL + pad * 2), fill: `url(#act-halo-${level})` }))
      }
      if (t !== null && t === bestT) {
        ring = h('rect', {
          x: r2(cx(col) - 2),
          y: r2(cy(row) - 2),
          width: r2(CELL + 4),
          height: r2(CELL + 4),
          rx: CELL_R + 1.5,
          stroke: color.text,
          'stroke-opacity': 0.9,
          'stroke-width': 1,
        })
      }
    }
    columns.push(cells)
  }

  // Month labels: at the first column whose Sunday falls in a new month.
  const months = []
  if (start !== null) {
    let prev = null
    for (let col = 0; col < COLS; col++) {
      const iso = isoOf(start + col * 7)
      const key = iso.slice(0, 7)
      if (key !== prev) months.push({ col, text: monthLabel(key), x: cx(col) })
      prev = key
    }
  }
  const MONTH = { ...MONO_TICK }
  // A leading month with fewer than 3 visible weeks yields its slot (GitHub's rule);
  // any later collision drops the newcomer.
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift()
  const kept = []
  for (const lab of months) {
    const w = measure(lab.text, MONTH)
    const prevLab = kept.at(-1)
    if (prevLab && lab.x - prevLab.x < prevLab.w + 10) continue
    if (lab.x + w > X1) continue
    kept.push({ ...lab, w })
  }

  const legendCell = 10
  const legendGap = 3
  const legendCy = labelY - capHeight(MONO_LABEL) / 2
  const moreW = measure(COPY.more, MONO_TICK)
  const swatchesW = heat.length * legendCell + (heat.length - 1) * legendGap
  const swX = X1 - moreW - 8 - swatchesW
  const legend = [
    txt(swX - 8, centerBaseline(legendCy, MONO_TICK), COPY.less, { ...MONO_TICK, fill: color.textTertiary, anchor: 'end' }),
    heat.map((fill, i) =>
      h('rect', { x: swX + i * (legendCell + legendGap), y: r2(legendCy - legendCell / 2), width: legendCell, height: legendCell, rx: 2, fill }),
    ),
    txt(X1, centerBaseline(legendCy, MONO_TICK), COPY.more, { ...MONO_TICK, fill: color.textTertiary, anchor: 'end' }),
  ]

  // Diagonal wave: one overlay group per diagonal (col + row) brightens and fades
  // in turn, sweeping top-left → bottom-right. Opacity only; each group rests at
  // opacity 0, so with animation off the heatmap is exactly the data.
  doc.css(`@keyframes act-wave{0%,100%{opacity:0}9%{opacity:1}26%{opacity:0}}
.act-wave{animation:act-wave ${WAVE.period}s cubic-bezier(.4,0,.2,1) infinite}`)
  const wave = h(
    'g',
    { fill: WAVE.color },
    [...waves.entries()]
      .sort((p, q) => p[0] - q[0])
      .map(([d, list]) => h('g', { class: 'act-wave', opacity: 0, style: phaseStyle(lagOf(d * WAVE.step, WAVE.period)) }, list)),
  )

  for (const level of [3, 4]) {
    radialGradient(doc, `act-halo-${level}`, [
      [0, heat[level], level === 4 ? 0.5 : 0.32],
      [0.55, heat[level], level === 4 ? 0.16 : 0.1],
      [1, heat[level], 0],
    ])
  }

  return [
    sectionLabel(PAD, labelY, COPY.graph),
    legend,
    kept.map((lab) => txt(lab.x, top + A_MONTH_DY, lab.text, { ...MONTH, fill: color.textTertiary })),
    [1, 3, 5].map((row) =>
      txt(PAD, centerBaseline(cy(row) + CELL / 2, MONO_TICK), DAY_SHORT[row], { ...MONO_TICK, fill: color.textTertiary }),
    ),
    hot.length ? h('g', {}, hot) : '',
    h('g', { id: 'act-cells' }, columns),
    wave,
    ring,
  ]
}

// ── B · monthly trend ───────────────────────────────────────────────────────
function trend(doc, m, top) {
  const labelY = top + LABEL_DY
  const plotTop = top + B_PLOT_DY
  const base = plotTop + B_PLOT_H
  const pts = m.monthly
  const max = Math.max(0, ...pts.map((p) => p.total))
  const { step, top: yTop } = niceScale(max, 4)
  const ticks = Array.from({ length: Math.round(yTop / step) + 1 }, (_, i) => i * step)
  // no data → no invented scale: bare gridlines (and a lone "0" for all-zero data)
  const labelled = !pts.length ? [] : max > 0 ? ticks : [0]
  const tickW = Math.max(measure('10K', MONO_TICK), ...labelled.map((v) => measure(tick(v), MONO_TICK)))
  const PX0 = PAD + Math.ceil(tickW) + 14
  const PX1 = X1 - 12
  const y = (v) => base - (v / yTop) * B_PLOT_H
  const x = (i) => (pts.length > 1 ? PX0 + (i * (PX1 - PX0)) / (pts.length - 1) : (PX0 + PX1) / 2)

  const grid = [
    h('path', {
      d: ticks.slice(1).map((v) => `M${PX0 - 4} ${r2(y(v)) + 0.5}H${X1}`).join(''),
      stroke: color.border,
    }),
    h('path', { d: `M${PX0 - 4} ${base + 0.5}H${X1}`, stroke: color.borderStrong }),
    labelled.map((v) =>
      txt(PAD + tickW, centerBaseline(y(v) + 0.5, MONO_TICK), tick(v), { ...MONO_TICK, fill: color.textTertiary, anchor: 'end', attrs: TAB }),
    ),
  ]

  const right = []
  if (pts.length) {
    const avg = pts.reduce((n, p) => n + p.total, 0) / pts.length
    right.push(
      rightRun(X1, labelY, [
        [int(avg), { size: 13, weight: 500, fill: color.text }],
        [COPY.avgMonth, { size: 13, fill: color.textTertiary }],
      ]),
    )
  }

  if (!pts.length) {
    return [sectionLabel(PAD, labelY, COPY.trend), grid, emptyNote((PX0 + X1) / 2, plotTop + B_PLOT_H / 2)]
  }

  const points = pts.map((p, i) => [r2(x(i)), r2(y(p.total))])
  const { line, area } = smoothPath(points, base)
  const lineGrad = linearGradient(doc, 'act-line', [
    [0, color.blue],
    [1, color.blueBright],
  ], { units: 'userSpaceOnUse', x1: PX0, y1: 0, x2: PX1, y2: 0 })
  const areaGrad = linearGradient(doc, 'act-area', [
    [0, color.blue, 0.3],
    [0.6, color.blue, 0.08],
    [1, color.blue, 0],
  ], { units: 'userSpaceOnUse', x1: 0, y1: plotTop, x2: 0, y2: base })
  const clip = doc.def(
    'act-plot-clip',
    h('clipPath', { id: 'act-plot-clip' }, h('rect', { x: PX0 - 2, y: plotTop - 24, width: X1 - PX0 + 4, height: B_PLOT_H + 24.5 })),
  )
  // Halftone under the curve (the pixelated-canvas texture): a dot lattice
  // aligned to the plot origin, fading out towards the axis.
  doc.def(
    'act-dots',
    h(
      'pattern',
      { id: 'act-dots', width: DOT_PITCH, height: DOT_PITCH, patternUnits: 'userSpaceOnUse', x: PX0, y: plotTop },
      h('circle', { cx: DOT_PITCH / 2, cy: DOT_PITCH / 2, r: 0.85, fill: color.blueBright }),
    ),
  )
  const dotFade = linearGradient(doc, 'act-dot-fade', [
    [0, '#ffffff', 0.75],
    [1, '#ffffff', 0],
  ], { units: 'userSpaceOnUse', x1: 0, y1: plotTop, x2: 0, y2: base })
  doc.def(
    'act-dot-mask',
    h(
      'mask',
      { id: 'act-dot-mask', maskUnits: 'userSpaceOnUse', x: PX0 - 2, y: plotTop - 24, width: X1 - PX0 + 4, height: B_PLOT_H + 24 },
      h('rect', { x: PX0 - 2, y: plotTop - 24, width: X1 - PX0 + 4, height: B_PLOT_H + 24, fill: `url(#${dotFade})` }),
    ),
  )

  // peak: a frozen hover — one-line tooltip above the point, halo dot, dashed
  // drop line to the axis. The tooltip lives in the headroom above the plot so
  // it never sits on the curve.
  let peakI = 0
  pts.forEach((p, i) => {
    if (p.total > pts[peakI].total) peakI = i
  })
  const [pkX, pkY] = points[peakI]
  const peakMonth = pts[peakI].month
  const tipHead = `${monthLabel(peakMonth)} ${peakMonth.slice(0, 4)}`.toUpperCase()
  const tipVal = int(pts[peakI].total)
  const TIP_HEAD = { size: 11, family: 'mono', tracking: 0.08 }
  const TIP_VAL = { size: 13, weight: 600 }
  const valW = measure(tipVal, TIP_VAL)
  const tipW = Math.ceil(10 + 6 + 7 + valW + 9 + measure(tipHead, TIP_HEAD) + 9)
  const tipH = 26
  const tipX = Math.max(PX0 - 4, Math.min(X1 - tipW, pkX - tipW / 2))
  const tipY = Math.max(plotTop - TIP_ROOM, pkY - 12 - tipH)
  const tipCy = tipY + tipH / 2
  const peak = pts[peakI].total > 0
    ? [
        h('path', { d: `M${pkX} ${r2(tipY + tipH)}V${r2(pkY - 7)}M${pkX} ${r2(pkY + 7)}V${base}`, stroke: color.borderHover, 'stroke-dasharray': '2 3' }),
        h('circle', { cx: pkX, cy: pkY, r: 8, fill: color.blue, opacity: 0.2 }),
        h('circle', { cx: pkX, cy: pkY, r: 3.5, fill: color.bg, stroke: color.blueBright, 'stroke-width': 2 }),
        h('rect', { x: r2(tipX) + 0.5, y: r2(tipY) + 0.5, width: tipW - 1, height: tipH - 1, rx: 6, fill: color.surface, stroke: color.borderStrong }),
        h('circle', { cx: r2(tipX + 13), cy: r2(tipCy), r: 3, fill: color.blueBright }),
        txt(r2(tipX + 23), r2(centerBaseline(tipCy, TIP_VAL)), tipVal, { ...TIP_VAL, fill: color.text, attrs: TAB }),
        txt(r2(tipX + 23 + valW + 9), r2(centerBaseline(tipCy, TIP_HEAD)), tipHead, { ...TIP_HEAD, fill: color.textTertiary }),
      ]
    : []

  // live: the current (partial) month pulses softly
  doc.css(`@keyframes act-pulse{0%{transform:scale(1);opacity:.5}80%,100%{transform:scale(3);opacity:0}}
.act-pulse{transform-box:fill-box;transform-origin:center;animation:act-pulse 3.6s cubic-bezier(0,0,.2,1) infinite}`)
  const [lx, ly] = points.at(-1)
  const live = peakI === pts.length - 1
    ? []
    : [
        h('circle', { cx: lx, cy: ly, r: 3.5, fill: color.blueBright, class: 'act-pulse' }),
        h('circle', { cx: lx, cy: ly, r: 3.5, fill: color.blueBright }),
      ]

  const months = pts.map((p, i) => {
    const isPeak = i === peakI && p.total > 0
    return txt(points[i][0], base + 22, monthLabel(p.month), {
      ...MONO_TICK,
      fill: isPeak ? color.text : color.textTertiary,
      anchor: 'middle',
    })
  })

  return [
    sectionLabel(PAD, labelY, COPY.trend),
    right,
    grid,
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      area ? h('path', { d: area, fill: `url(#${areaGrad})` }) : '',
      area ? h('path', { d: area, fill: 'url(#act-dots)', mask: 'url(#act-dot-mask)' }) : '',
      // glow: three faint, widening strokes (a filter would re-rasterise every frame)
      line
        ? h(
            'g',
            { stroke: color.blue, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' },
            h('path', { d: line, 'stroke-width': 14, 'stroke-opacity': 0.05 }),
            h('path', { d: line, 'stroke-width': 9, 'stroke-opacity': 0.08 }),
            h('path', { d: line, 'stroke-width': 5, 'stroke-opacity': 0.16 }),
          )
        : '',
      line
        ? h('path', {
            d: line,
            stroke: `url(#${lineGrad})`,
            'stroke-width': 2,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          })
        : '',
      line ? pulseAlong(doc, { d: line, color: '#d6ebff', duration: 7.5, delay: 2.2, length: 9, width: 2, rest: 0.35, opacity: 0.85 }) : '',
    ),
    peak,
    live,
    months,
  ]
}

// ── C · by weekday ──────────────────────────────────────────────────────────
function weekdays(doc, m, top) {
  const labelY = top + LABEL_DY
  const y0 = top + R_CONTENT_DY
  const x0 = PAD
  const xEnd = COL - GUTTER
  const vals = m.weekday
  const max = Math.max(0, ...vals.map((v) => v ?? 0))
  const total = vals.reduce((n, v) => n + (v ?? 0), 0)
  let busiest = -1
  if (max > 0) vals.forEach((v, i) => {
    if (busiest < 0 && v === max) busiest = i
  })

  const VAL = { size: 12, family: 'mono' }
  const SHARE = { size: 12, family: 'mono' }
  const shareW = measure('100%', SHARE)
  const valW = Math.max(measure('00,000', VAL), ...vals.map((v) => measure(int(v), VAL)))
  const shareX = xEnd
  const valX = shareX - shareW - 14
  const trackX1 = valX - valW - 16
  const trackW = trackX1 - x0

  linearGradient(doc, 'act-wd-hot', [
    [0, color.blue, 0.9],
    [1, color.blueBright, 0.95],
  ])
  linearGradient(doc, 'act-wd', [
    [0, '#0b2244'],
    [1, '#0d2f5c'],
  ])

  const rows = vals.map((v, i) => {
    const ry = y0 + i * (ROW_H + ROW_GAP)
    const rcy = ry + ROW_H / 2
    const hot = i === busiest
    const bw = v && max ? Math.max(6, (v / max) * trackW) : 0
    const NAME = { size: 13, weight: hot ? 500 : 400 }
    return [
      h('rect', { x: x0 + 0.5, y: ry + 0.5, width: trackW - 1, height: ROW_H - 1, rx: 6, fill: color.surface, stroke: color.border }),
      bw
        ? h('rect', {
            x: x0,
            y: ry,
            width: r2(bw),
            height: ROW_H,
            rx: 6,
            fill: hot ? 'url(#act-wd-hot)' : 'url(#act-wd)',
          })
        : '',
      hot && bw ? shineSweep(doc, { x: x0, y: ry, w: r2(bw), h: ROW_H, r: 6, duration: 9, delay: 1.5, opacity: 0.22, band: 72 }) : '',
      txt(x0 + 10, centerBaseline(rcy, NAME), DAY_NAMES[i], { ...NAME, fill: hot ? '#ffffff' : color.text }),
      hot && bw > 150
        ? txt(x0 + bw - 10, centerBaseline(rcy, MONO_TICK), COPY.busiest.toUpperCase(), {
            ...MONO_TICK,
            tracking: 0.08,
            fill: '#ffffff',
            opacity: 0.78,
            anchor: 'end',
          })
        : '',
      txt(valX, centerBaseline(rcy, VAL), int(v), { ...VAL, fill: hot ? color.text : color.textSecondary, anchor: 'end', attrs: TAB }),
      txt(shareX, centerBaseline(rcy, SHARE), total && v !== null ? `${Math.round((v / total) * 100)}%` : '—', {
        ...SHARE,
        fill: hot ? color.blueBright : color.textTertiary,
        anchor: 'end',
        attrs: TAB,
      }),
    ]
  })

  return [sectionLabel(PAD, labelY, COPY.weekday), rows]
}

// ── D · by year ─────────────────────────────────────────────────────────────
function years(doc, m, top) {
  const labelY = top + LABEL_DY
  const x0 = COL + GUTTER
  const xEnd = X1
  const contentTop = top + R_CONTENT_DY
  const base = contentTop + ROWS_H - 38
  const barTop = contentTop + 22
  const list = m.byYear
  const out = [sectionLabel(x0, labelY, COPY.year)]
  out.push(h('path', { d: `M${x0} ${base + 0.5}H${xEnd}`, stroke: color.borderStrong }))
  if (!list.length) {
    out.push(emptyNote((x0 + xEnd) / 2, (barTop + base) / 2))
    return out
  }

  const max = Math.max(1, ...list.map((y) => y.total))
  const refYear = m.refDay !== null && m.refDay !== undefined ? Number(isoOf(m.refDay).slice(0, 4)) : null
  const refIsYearEnd = m.refDay !== null && m.refDay !== undefined && isoOf(m.refDay).slice(5) === '12-31'

  // growth story: current year vs the first year that registers on the scale
  const first = list.find((y) => y.total >= max * 0.02)
  const lastY = list.at(-1)
  if (first && first !== lastY && first.total > 0) {
    const ratio = lastY.total / first.total
    if (ratio >= 1.5) {
      const label = `${ratio >= 10 ? Math.round(ratio) : r2(Math.round(ratio * 10) / 10)}×`
      const NOTE = { size: 13 }
      const run = [
        [label, { ...NOTE, weight: 500, fill: color.text }],
        [` ${COPY.since} ${first.year}`, { ...NOTE, fill: color.textTertiary }],
      ]
      const gx = xEnd - runWidth(run) - 6 - 14
      out.push(
        glyph('trendingUp', { x: r2(gx), y: r2(labelY - capHeight(NOTE) / 2 - 7), size: 14, stroke: color.blueBright, strokeWidth: 1.75 }),
        rightRun(xEnd, labelY, run),
      )
    }
  }

  linearGradient(doc, 'act-yr', [
    [0, '#0d4a94'],
    [1, '#0a2a4f'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  linearGradient(doc, 'act-yr-hot', [
    [0, color.blueBright],
    [1, color.blue],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })

  const band = (xEnd - x0) / list.length
  const bw = Math.max(12, Math.min(40, band * 0.5))
  const span = base - barTop
  list.forEach((y, i) => {
    const cx = x0 + band * (i + 0.5)
    const isLast = i === list.length - 1
    const partial = isLast && y.year === refYear && !refIsYearEnd
    const bh = y.total > 0 ? Math.max(2, (y.total / max) * span) : 0
    const by = base - bh
    const VAL = { size: 12, family: 'mono', weight: isLast ? 500 : 400 }
    if (bh) {
      if (isLast && bh > 8) {
        // the current year glows like the trend line: a pre-blurred halo (gradient, no filter)
        const halo = radialGradient(doc, 'act-bar-halo', [
          [0, color.blue, 0.34],
          [0.6, color.blue, 0.1],
          [1, color.blue, 0],
        ])
        out.push(h('rect', { x: r2(cx - bw * 1.1), y: r2(by - 22), width: r2(bw * 2.2), height: r2(bh + 22), fill: `url(#${halo})` }))
      }
      out.push(
        h('path', {
          d: topRounded(cx - bw / 2, by, bw, bh, 4),
          fill: isLast ? 'url(#act-yr-hot)' : 'url(#act-yr)',
        }),
      )
      if (isLast && bh > 8) {
        out.push(shineSweep(doc, { x: r2(cx - bw / 2), y: r2(by), w: r2(bw), h: r2(bh), r: 4, duration: 9, delay: 5.5, opacity: 0.22, band: 40, angle: 24 }))
      }
      if (isLast) {
        // lit top edge on the current year
        out.push(h('path', { d: `M${r2(cx - bw / 2 + 4)} ${r2(by) + 0.5}H${r2(cx + bw / 2 - 4)}`, stroke: '#ffffff', 'stroke-opacity': 0.55 }))
      }
    }
    out.push(
      txt(cx, r2(by - 8), compact(y.total), { ...VAL, fill: isLast ? color.text : color.textSecondary, anchor: 'middle', attrs: TAB }),
      txt(cx, base + 20, String(y.year), { ...MONO_TICK, fill: isLast ? color.text : color.textTertiary, anchor: 'middle', attrs: TAB }),
    )
    if (partial) {
      out.push(txt(cx, base + 35, COPY.ytd, { ...MONO_TICK, tracking: 0.08, fill: color.blueBright, anchor: 'middle' }))
    }
  })
  return out
}

// ── render ──────────────────────────────────────────────────────────────────
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
  const parts = []
  parts.push(
    isNum(m.lastYear)
      ? `${int(m.lastYear)} contributions in the last year${m.days.length ? ` (${date(isoOf(m.days[0].t))} – ${date(isoOf(m.days.at(-1).t))})` : ''}.`
      : 'Contribution activity over the last year.',
  )
  if (isNum(m.activeDays)) parts.push(`${int(m.activeDays)} active days.`)
  if (m.monthly.length) {
    const peak = m.monthly.reduce((a, b) => (b.total > a.total ? b : a))
    parts.push(`Monthly trend: ${m.monthly.map((p) => `${monthLabel(p.month)} ${p.month.slice(0, 4)} ${int(p.total)}`).join(', ')}; peak ${int(peak.total)} in ${monthLabel(peak.month)} ${peak.month.slice(0, 4)}.`)
  }
  if (m.hasWeekday) parts.push(`By weekday: ${m.weekday.map((v, i) => `${DAY_NAMES[i]} ${int(v)}`).join(', ')}.`)
  if (m.byYear.length) parts.push(`By year: ${m.byYear.map((y) => `${y.year} ${int(y.total)}`).join(', ')}.`)
  return parts.join(' ')
}

function render(data) {
  const m = model(data ?? {})
  const A_TOP = HEADER_H
  const B_TOP = A_TOP + A_H
  const R_TOP = B_TOP + B_H
  const H = R_TOP + R_H

  const doc = createDoc({ width: W, height: H, title: 'RunyShark — contribution activity', desc: describe(m) })
  const clip = panelClip(doc)
  const head = header(doc, m, data)

  const lines = [A_TOP, B_TOP, R_TOP]
  const guides = [
    h('path', { d: lines.map((ly) => `M0 ${ly + 0.5}H${W}`).join(''), stroke: color.border }),
    h('path', { d: `M${COL + 0.5} ${R_TOP}V${H}`, stroke: color.border }),
    crosshair(COL + 0.5, R_TOP + 0.5, { stroke: color.textMuted }),
  ]

  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, head.back, guides),
    head.front,
    heatmap(doc, m, A_TOP),
    trend(doc, m, B_TOP),
    weekdays(doc, m, R_TOP),
    years(doc, m, R_TOP),
    beam(doc, { x: 0, y: 0, w: W, h: H, r: 16, color: color.blueBright, duration: BEAM.duration, delay: BEAM.delay, length: 55, width: 1.25 }),
  )
}

export default {
  name: 'activity',
  render({ data } = {}) {
    return [{ path: 'assets/generated/activity.svg', svg: render(data) }]
  },
}
