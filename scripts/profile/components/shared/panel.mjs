// Shared panel system: the one toolbar, footer, freshness status, type scale
// and chip palette every data panel uses (DESIGN.md §2.1). Components lay out
// their own content; this module keeps the frame identical from panel to panel.
//
//   const head = panelHeader(doc, {
//     icon: { brand: 'github' },                       // or { glyph: 'clock' } / { label: 'W' }
//     title: 'Impact', subtitle: 'GitHub activity across every repository',
//     pills: [periodPill('Last 12 months'), freshnessPill(freshness(data, 'github'), { pulse: true })],
//   })                                                 // → { height: 64, markup }
//   const foot = panelFooter(doc, {
//     y: H - 48,
//     left: [['Source', 'GitHub GraphQL API · incl. private repositories']],
//     right: [['Window', '368 days · UTC−6']],
//   })                                                 // → { height: 48, markup }
//
// Everything here is deterministic and tolerates missing input: a missing title,
// pill value or footer value is dropped, never printed as "undefined"/"NaN".

import { profile } from '../../content.mjs'
import { dateInZone, signedPercent } from '../../core/format.mjs'
import { glyph as drawGlyph, hasGlyph } from '../../core/glyphs.mjs'
import { hasIcon } from '../../core/icons.mjs'
import { iconTile, statusDot } from '../../core/primitives.mjs'
import { esc, h } from '../../core/svg.mjs'
import { capHeight, centerBaseline, measure, truncate, txt } from '../../core/text.mjs'
import { color } from '../../core/tokens.mjs'

export { eyebrow } from '../../core/primitives.mjs'

// ── Layout ────────────────────────────────────────────────────────────────
export const PANEL = {
  width: 860, // every SVG canvas
  pad: 32, // panel padding: header, content and footer all start here
  gap: 16,
  toolbar: 64, // panelHeader height (hairline included)
  footer: 48, // panelFooter height (hairline included)
  radius: 16,
}

// ── Type scale (DESIGN.md §2.1 rule 3) ───────────────────────────────────
// Spread into txt()/measure(): txt(x, y, '44.8K', { ...TYPE.kpi, fill: INK.primary, attrs: NUMERIC }).
export const TYPE = {
  heroStat: { size: 40, weight: 600, tracking: -0.04 }, // hero stat strip
  kpi: { size: 32, weight: 600, tracking: -0.04 }, // panel KPI numbers
  secondary: { size: 24, weight: 600, tracking: -0.03 }, // secondary numbers
  statement: { size: 18, weight: 600, tracking: -0.02 }, // data-statement / KPI line (18–20px), never a headline
  title: { size: 15, weight: 600, tracking: -0.01 }, // toolbar title
  subtitle: { size: 13, weight: 400 }, // toolbar subtitle
  body: { size: 14, weight: 400 },
  small: { size: 13, weight: 400 },
  unit: { size: 14, weight: 500 }, // unit beside a KPI number
  pill: { size: 13, weight: 500 },
  chip: { size: 12, weight: 500 },
  eyebrow: { size: 12, family: 'mono', weight: 400, tracking: 0.08 }, // = primitives.eyebrow(), uppercase
  footer: { size: 11, family: 'mono', weight: 400, tracking: 0.08 }, // footer labels, uppercase
  tick: { size: 11, family: 'mono', weight: 400 }, // axis ticks only: the one place 11px text is allowed
}

// Text colours. Nothing a person reads is darker than INK.tertiary; #454545
// (color.textMuted) is for strokes, guides and separators only.
export const INK = {
  primary: color.text, // #ededed
  secondary: color.textSecondary, // #a1a1a1
  tertiary: color.textTertiary, // #878787
}

// attrs for every number: digits keep their column.
export const NUMERIC = { style: 'font-variant-numeric:tabular-nums' }

// ── Chips (rule 5: green = positive delta / live, everything else neutral) ─
export const CHIP = {
  positive: { fill: color.greenBright, fillOpacity: 0.1, stroke: color.greenBright, strokeOpacity: 0.32, text: color.greenBright },
  neutral: { fill: color.surface3, fillOpacity: null, stroke: color.borderStrong, strokeOpacity: null, text: color.text },
}

export function chipTone(tone) {
  return CHIP[tone] ?? CHIP.neutral
}

/**
 * Small rounded chip: chip({ x, cy, text, tone: 'positive' | 'neutral' }) → { width, height, markup }.
 * `cy` is the centre line (or pass `y` for the top edge); align 'start' | 'middle' | 'end'.
 */
export function chip({ x, y, cy, text, tone = 'neutral', height = 20, size = TYPE.chip.size, weight = TYPE.chip.weight, padX = 8, align = 'start' }) {
  const label = clean(text)
  if (!label) return { width: 0, height: 0, markup: '' }
  const t = chipTone(tone)
  const font = { size, weight }
  const width = Math.ceil(measure(label, font) + padX * 2)
  const left = align === 'middle' ? x - width / 2 : align === 'end' ? x - width : x
  const mid = cy ?? (y ?? 0) + height / 2
  return {
    width,
    height,
    markup: [
      h('rect', {
        x: r2(left + 0.5),
        y: r2(mid - height / 2 + 0.5),
        width: width - 1,
        height: height - 1,
        rx: (height - 1) / 2,
        fill: t.fill,
        'fill-opacity': t.fillOpacity,
        stroke: t.stroke,
        'stroke-opacity': t.strokeOpacity,
      }),
      txt(r2(left + width / 2), r2(centerBaseline(mid, font)), label, { ...font, fill: t.text, anchor: 'middle', attrs: NUMERIC }),
    ].join(''),
  }
}

/**
 * Delta chip from a ratio (2.63 → "+263%", −0.12 → "−12%"). Positive deltas are
 * green, negatives neutral; null when the ratio is missing or rounds to 0 — hide it.
 */
export function deltaChip({ ratio, digits = 0, ...opts }) {
  const text = signedPercent(ratio, { digits })
  if (!text) return null
  return { text, ...chip({ ...opts, text, tone: ratio > 0 ? 'positive' : 'neutral' }) }
}

/**
 * KPI number + unit, tabular: metric(x, y, { value: '44.8K', unit: 'h' }) → markup.
 * scale: 'heroStat' | 'kpi' | 'secondary'. The unit sits 2px after the number,
 * gray, no word space ("5,186h", "122/day"). A missing value renders "—".
 */
export function metric(x, y, { value, unit, scale = 'kpi', fill = INK.primary, unitFill = INK.tertiary, anchor } = {}) {
  const font = TYPE[scale] ?? TYPE.kpi
  const v = clean(value)
  if (!v || v === '—') return txt(x, y, '—', { ...font, fill: INK.tertiary, anchor, attrs: NUMERIC })
  const u = clean(unit)
  const unitSize = font.size >= 40 ? 16 : font.size >= 32 ? TYPE.unit.size : 13
  const content = [
    esc(v),
    u ? `<tspan dx="2" font-size="${unitSize}" letter-spacing="0em" fill="${unitFill}" class="f-sans-500">${esc(u)}</tspan>` : '',
  ].join('')
  return txt(x, y, '', { ...font, fill, anchor, attrs: NUMERIC, content })
}

// ── Freshness (rule 7) ───────────────────────────────────────────────────
const STATE = { live: 'live', cache: 'cache', cached: 'cache', seed: 'seed', snapshot: 'seed', partial: 'partial' }
const STATE_LABEL = { live: 'Live', cache: 'Cached', seed: 'Snapshot', partial: 'Partial', none: 'No data' }

/**
 * How fresh one source's data is, from data.sources:
 *   freshness(data, 'github')   → { state: 'live', live: true,  label: 'Live',     date: 'Oct 21, 2026', at, text }
 *   freshness(data, 'wakatime') → { state: 'seed', live: false, label: 'Snapshot', date: null, … }
 * States: live → 'Live', cache → 'Cached', seed → 'Snapshot', partial → 'Partial';
 * no source flag at all → 'Cached' when the model has a timestamp, else 'No data'.
 * The timestamp is the source's own (`sources.githubAt` / `sources.wakatimeAt`, or an
 * object `sources.github = { status, at }`) and falls back to data.generatedAt.
 * `date` is that instant as a calendar day in `tz` (default profile.timezone).
 */
export function freshness(data, key, { tz = profile.timezone ?? 'UTC' } = {}) {
  const sources = data?.sources && typeof data.sources === 'object' ? data.sources : {}
  const raw = sources[key]
  const flag = typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? raw.status ?? raw.state : null
  const at = firstTimestamp(sources[`${key}At`], raw?.at, raw?.updatedAt, raw?.fetchedAt, data?.generatedAt)
  const state = STATE[String(flag ?? '').toLowerCase()] ?? (at ? 'cache' : 'none')
  const label = STATE_LABEL[state]
  const date = state === 'seed' || state === 'none' ? null : dateInZone(at, tz)
  return { state, live: state === 'live', label, date, at, text: date ? `${label} · ${date}` : label }
}

/**
 * Status-pill spec for panelHeader from freshness():
 *   live   → "● Live · updated Oct 21, 2026" (green dot; pulse only where the motion budget allows: Impact)
 *   other  → "● Cached · Oct 21, 2026" / "● Snapshot" / "● Partial · …" (neutral gray dot)
 *   none   → "○ No data" (hollow gray ring)
 */
export function freshnessPill(f, { pulse = false, updated = true } = {}) {
  if (!f) return null
  if (f.live) return { label: f.label, value: updated && f.date ? `updated ${f.date}` : f.date, status: 'live', pulse }
  return { label: f.label, value: f.date, status: f.state === 'none' ? 'none' : 'cached' }
}

// Period pill: calendar glyph + range ("Last 12 months").
export function periodPill(label, { glyph = 'calendar' } = {}) {
  return { label, glyph }
}

// ── Toolbar (rule 1) ─────────────────────────────────────────────────────
const PILL_H = 28
const TILE = 28
const LABEL_FONT = { size: TYPE.pill.size, weight: 500 }
const VALUE_FONT = { size: TYPE.pill.size, weight: 400 }
const SEP = ' · '

/**
 * One toolbar pill, right-aligned at `right`, centred on `cy` → { width, markup }.
 * spec: { label, value?, glyph?, status?: 'live' | 'cached' | 'none' | null, pulse? }.
 * live = green dot (pulse only when `pulse`), cached = gray dot, none = hollow gray
 * ring ("No data"). Status pills are fully rounded; plain/glyph pills (periods,
 * filters) use radius 6.
 */
export function toolbarPill(doc, { right, cy, label, value, glyph, status = null, pulse = false }) {
  const text = clean(label)
  const extra = clean(value)
  if (!text && !extra) return { width: 0, markup: '' }
  const main = text || extra
  const tail = text ? extra : null
  const dot = status === 'live' || status === 'cached' || status === 'none'
  const icon = !dot && glyph && hasGlyph(glyph)
  const lead = dot ? 12 + 7 + 8 : icon ? 10 + 14 + 7 : 12
  const textW = measure(main, LABEL_FONT) + (tail ? measure(`${SEP}${tail}`, VALUE_FONT) : 0)
  const width = Math.ceil(lead + textW + 12)
  const left = right - width
  const top = cy - PILL_H / 2
  const parts = [
    h('rect', {
      x: r2(left + 0.5),
      y: r2(top + 0.5),
      width: width - 1,
      height: PILL_H - 1,
      rx: dot ? (PILL_H - 1) / 2 : 6,
      fill: color.surface,
      stroke: color.borderStrong,
    }),
  ]
  if (status === 'none') {
    parts.push(h('circle', { cx: r2(left + 12 + 3.5), cy, r: 3, stroke: INK.tertiary, 'stroke-width': 1.25 }))
  } else if (dot) {
    const live = status === 'live'
    parts.push(statusDot(doc, r2(left + 12 + 3.5), cy, { fill: live ? color.greenBright : INK.tertiary, r: 3.5, pulse: live && pulse }))
  } else if (icon) {
    parts.push(drawGlyph(glyph, { x: r2(left + 10), y: cy - 7, size: 14, stroke: INK.secondary, strokeWidth: 1.6 }))
  }
  const content = [
    esc(main),
    tail
      ? `<tspan class="f-sans-400" fill="${INK.tertiary}">${esc(SEP)}</tspan><tspan class="f-sans-400" fill="${INK.secondary}">${esc(tail)}</tspan>`
      : '',
  ].join('')
  parts.push(txt(r2(left + lead), r2(centerBaseline(cy, LABEL_FONT)), '', { ...LABEL_FONT, fill: INK.primary, content, attrs: NUMERIC }))
  return { width, markup: parts.join('') }
}

/**
 * The panel toolbar: 64px tall, 28px monochrome icon tile at the panel padding,
 * title 15/600 (+ subtitle 13px) beside it, pills right-aligned, hairline below.
 *   panelHeader(doc, { x, y, width, pad, icon, title, subtitle, pills, rule }) → { height: 64, markup }
 * icon: { glyph } | { brand } | { label } (monogram) | null (no tile).
 * pills: left-to-right; the last one touches the right padding. Falsy entries are skipped;
 *   pills that would squeeze the title below ~200px are dropped from the left.
 * rule: false skips the hairline (when the component already draws a guide there).
 */
export function panelHeader(doc, { x = 0, y = 0, width = PANEL.width, pad = PANEL.pad, icon, title, subtitle, pills = [], rule = true } = {}) {
  const height = PANEL.toolbar
  const cy = y + height / 2
  const left = x + pad
  const parts = []
  const tile = iconSpec(icon)
  const textX = tile ? left + TILE + 12 : left
  const t0 = clean(title)
  const s0 = clean(subtitle)

  // pills, laid out right → left. The title keeps up to 200px (its own width when
  // shorter); a pill that would eat into that is dropped together with every pill
  // left of it, so the rightmost (status) pill always survives.
  const reserve = Math.min(200, Math.max(t0 ? measure(t0, TYPE.title) : 0, s0 ? Math.min(measure(s0, TYPE.subtitle), 120) : 0))
  let edge = x + width - pad
  const drawn = []
  for (const spec of [...(Array.isArray(pills) ? pills : [])].filter(Boolean).reverse()) {
    const p = toolbarPill(doc, { ...spec, right: edge, cy })
    if (!p.width) continue
    if (drawn.length && edge - p.width - 24 < textX + reserve) break
    drawn.unshift(p.markup)
    edge -= p.width + 8
  }
  const pillsLeft = drawn.length ? edge + 8 : x + width - pad

  // icon tile
  if (tile) {
    parts.push(
      iconTile(doc, {
        x: left,
        y: cy - TILE / 2,
        size: TILE,
        r: 7,
        ...tile,
        iconSize: tile.brand ? 15 : 14,
        iconColor: INK.primary,
        fill: color.surface2,
        stroke: color.borderStrong,
      }),
    )
  }

  // title + subtitle (truncated to the room left of the pills)
  const room = pillsLeft - 24 - textX
  const t = room >= 24 ? t0 : null
  const s = room >= 24 ? s0 : null
  const titleFont = TYPE.title
  if (t && s) {
    // title cap-top on the tile's top edge, subtitle baseline on its bottom edge
    const titleBase = cy - TILE / 2 + capHeight(titleFont)
    parts.push(
      txt(r2(textX), r2(titleBase), truncate(t, room, titleFont), { ...titleFont, fill: INK.primary }),
      txt(r2(textX), r2(cy + TILE / 2 - 1), truncate(s, room, TYPE.subtitle), { ...TYPE.subtitle, fill: INK.secondary }),
    )
  } else if (t || s) {
    const font = t ? titleFont : TYPE.subtitle
    parts.push(txt(r2(textX), r2(centerBaseline(cy, font)), truncate(t || s, room, font), { ...font, fill: t ? INK.primary : INK.secondary }))
  }

  parts.push(...drawn)
  if (rule) parts.push(h('path', { d: `M${x} ${y + height - 0.5}H${x + width}`, stroke: color.border }))
  return { height, markup: parts.join('') }
}

// ── Footer (rule 4) ──────────────────────────────────────────────────────
const FOOT_LABEL = { ...TYPE.footer }
const FOOT_VALUE = { size: TYPE.footer.size, family: 'mono', weight: 400 }
const PAIR_GAP = 8 // label → value
const GROUP_GAP = 24 // pair → pair

/**
 * Provenance strip: mono 11px "LABEL value" pairs (label uppercase #878787,
 * value as written #a1a1a1), a left group and a right-aligned group:
 *   panelFooter(doc, { y, left: [['Source', 'GitHub GraphQL API']], right: [['Window', '368 days · UTC−6']] })
 *   → { height: 48, markup }
 * Pairs whose value is missing keep the label only when the label is all there
 * is ([label]); [label, null] is dropped. Values that would collide are truncated.
 * rule: true draws the hairline on the footer's top edge.
 */
export function panelFooter(doc, { y, x = 0, width = PANEL.width, pad = PANEL.pad, height = PANEL.footer, left = [], right = [], rule = true } = {}) {
  const top = y ?? 0
  const cy = top + height / 2
  const base = r2(centerBaseline(cy, FOOT_VALUE))
  const L = pairsOf(left)
  const R = pairsOf(right)
  const avail = width - pad * 2
  let lw = groupWidth(L)
  let rw = groupWidth(R)
  const gap = L.length && R.length ? 32 : 0
  if (lw + rw + gap > avail) {
    const share = (avail - gap) / (lw + rw)
    fitGroup(R, Math.max(rw * share, Math.min(rw, avail * 0.35)))
    rw = groupWidth(R)
    fitGroup(L, avail - gap - rw)
    lw = groupWidth(L)
  }
  const parts = []
  if (rule) parts.push(h('path', { d: `M${x} ${top + 0.5}H${x + width}`, stroke: color.border }))
  parts.push(drawGroup(L, x + pad, base), drawGroup(R, x + width - pad - rw, base))
  return { height, markup: parts.join('') }
}

function pairsOf(list) {
  return (Array.isArray(list) ? list : [])
    .map((pair) => {
      const [label, value] = Array.isArray(pair) ? pair : [pair]
      const l = clean(label)
      const v = clean(value)
      if (!l && !v) return null
      if (Array.isArray(pair) && pair.length > 1 && !v) return null // [label, missing] → drop the pair
      return { label: l ? l.toUpperCase() : '', value: v }
    })
    .filter(Boolean)
}

function pairWidth(p) {
  const lw = p.label ? measure(p.label, FOOT_LABEL) : 0
  const vw = p.value ? measure(p.value, FOOT_VALUE) : 0
  return lw + vw + (p.label && p.value ? PAIR_GAP : 0)
}

function groupWidth(group) {
  return group.reduce((sum, p, i) => sum + pairWidth(p) + (i ? GROUP_GAP : 0), 0)
}

// Truncate values from the last pair backwards until the group fits `maxW`.
function fitGroup(group, maxW) {
  for (let i = group.length - 1; i >= 0 && groupWidth(group) > maxW; i--) {
    const p = group[i]
    if (!p.value) continue
    const over = groupWidth(group) - maxW
    const target = Math.max(24, measure(p.value, FOOT_VALUE) - over)
    p.value = truncate(p.value, target, FOOT_VALUE)
  }
}

function drawGroup(group, x0, base) {
  let x = x0
  const out = []
  group.forEach((p, i) => {
    if (i) x += GROUP_GAP
    if (p.label) {
      out.push(txt(r2(x), base, p.label, { ...FOOT_LABEL, fill: INK.tertiary }))
      x += measure(p.label, FOOT_LABEL) + (p.value ? PAIR_GAP : 0)
    }
    if (p.value) {
      out.push(txt(r2(x), base, p.value, { ...FOOT_VALUE, fill: INK.secondary, attrs: NUMERIC }))
      x += measure(p.value, FOOT_VALUE)
    }
  })
  return out.join('')
}

// ── helpers ──────────────────────────────────────────────────────────────
function r2(v) {
  return Math.round(v * 100) / 100
}

// String for display, or null when the input is missing / not printable.
function clean(v) {
  if (v === null || v === undefined || v === false) return null
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null
  const s = String(v).trim()
  return s && s !== 'undefined' && s !== 'null' && s !== 'NaN' ? s : null
}

function firstTimestamp(...values) {
  for (const v of values) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(new Date(v.length === 10 ? `${v}T00:00:00Z` : v).getTime())) return v
  }
  return null
}

function iconSpec(icon) {
  if (!icon) return null
  if (icon.glyph && hasGlyph(icon.glyph)) return { glyph: icon.glyph }
  if (icon.brand && hasIcon(icon.brand)) return { brand: icon.brand }
  const label = clean(icon.label) ?? clean(icon.brand) ?? clean(icon.glyph)
  return label ? { label } : null
}
