// Coding activity (WakaTime) — a Vercel-dashboard panel in one SVG.
//
//   ┌ ▣ Coding activity ─────────────────── [▣ Last 12 months] [● Live/Snapshot] ┐
//   ├──────────────┼──────────────┼──────────────┤
//   │ TOTAL        │ LAST 12 MO   │ DAILY AVG    │  numbers + one micro-visual each
//   ├──────────────┼──────────────┼──────────────┤
//   │ [TS] lang    │ [VS] editor  │ [⊞] OS       │  icon tile + label + name + share
//   ├──────────────┴──────────────┴──────────────┤
//   │ LANGUAGES         Top 4 · rest grouped as Other │
//   │ ████████████████████▌██▌█▌▌▒▒▒▒▒  stacked bar │  always 100 %: "Other" closes it
//   │ ▓▓▓▓▓▓▓▓▓▓▓▓ TypeScript           55.0%  1,397 h │  Vercel-Analytics rows
//   ├────────────────────────────────────────────┤
//   │ SOURCE WakaTime · …                BASIS 1 work-week = 40 h │
//
// Data: data.wakatime (DESIGN.md §6). Every field may be missing; with no
// WakaTime block at all the panel renders an empty state instead.

import { glyph, hasGlyph } from '../core/glyphs.mjs'
import { brandIcon, hasIcon } from '../core/icons.mjs'
import { crosshair, iconTile, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'
import { shineSweep, starfield } from '../core/motion.mjs'
import { PANEL, TYPE, chip, freshness, freshnessPill, panelFooter, panelHeader, periodPill } from './shared/panel.mjs'

// ── copy that content.mjs does not carry ────────────────────────────────────
const COPY = {
  title: 'Coding activity',
  subtitle: 'Editor telemetry, measured by WakaTime',
  range: 'Last 12 months',
  total: 'Total coding time',
  lastYear: 'Last 12 months',
  daily: 'Daily average',
  language: 'Top language',
  editor: 'Editor',
  os: 'Operating system',
  languages: 'Languages',
  emptyTitle: 'Coding activity is syncing',
  emptyText: 'WakaTime stats appear here after the next scheduled build.',
  source: 'WakaTime · last 12 months',
  basis: '1 work-week = 40 h',
}

// WakaTime language names → simple-icons slugs (vendor/icons.json).
const LANG_ICON = {
  typescript: 'typescript',
  tsx: 'typescript',
  javascript: 'javascript',
  jsx: 'javascript',
  markdown: 'markdown',
  mdx: 'markdown',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  bash: 'gnubash',
  shell: 'gnubash',
  'shell script': 'gnubash',
  sh: 'gnubash',
  zsh: 'gnubash',
  python: 'python',
  powershell: 'powershell',
  css: 'css',
  html: 'html5',
  scss: 'sass',
  sass: 'sass',
  graphql: 'graphql',
  prisma: 'prisma',
  docker: 'docker',
  dockerfile: 'docker',
  'docker compose': 'docker',
  git: 'git',
  'git config': 'git',
  'json with comments': 'json',
  astro: 'astro',
}
// Names without a logo that still deserve a meaningful UI glyph.
const LANG_GLYPH = {
  other: 'layers',
  text: 'fileText',
  yaml: 'fileText',
  toml: 'fileText',
  ini: 'fileText',
  xml: 'fileText',
  csv: 'fileText',
  properties: 'fileText',
  batchfile: 'terminal',
  fish: 'terminal',
}

// ── geometry ────────────────────────────────────────────────────────────────
const W = layout.width
const PAD = layout.pad // 32
const COLS = [0, 287, 573, W]
const HEADER_H = PANEL.toolbar // 64, the shared toolbar
const KPI_H = 136
const ID_H = 100
const ROW_H = 36
const NAME_COL = 176 // icon + language name
const BAR_H = 10
const FOOT_H = PANEL.footer
const MAX_LANGS = 8 // list rows, "Other" included
const VALUE_COL = 168 // right column of the language list (percent + hours)

const MONO_LABEL = TYPE.eyebrow // 12px mono eyebrow (DESIGN.md rule 3)
const KPI = { size: 32, weight: 600, tracking: -0.04 }
const UNIT = { size: 16, weight: 500, tracking: -0.01 }
const NUM = { style: 'font-variant-numeric:tabular-nums' }

// ── helpers ─────────────────────────────────────────────────────────────────
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const pos = (v) => (num(v) !== null && v > 0 ? v : null)
const r2 = (v) => Math.round(v * 100) / 100
const intFmt = new Intl.NumberFormat('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const hoursOf = (seconds) => (pos(seconds) === null ? null : seconds / 3600)
const hoursText = (seconds) => {
  const hrs = hoursOf(seconds)
  if (hrs === null) return null
  return hrs < 1 ? '<1' : intFmt.format(Math.round(hrs))
}

// '2022-01-01' → 'Jan 2022'
function monthYear(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''))
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}
const pctText = (p, digits = 1) => `${p.toFixed(digits)}%`

// Blend two hex colours (t = 0 → a, 1 → b).
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// Restrained ramp: Geist blue for the lead language easing into cool slate.
function rampColor(i, n) {
  if (n <= 1) return color.blueBright
  const t = (i / (n - 1)) ** 0.85
  return mix(color.blueBright, '#5d6672', t)
}

// ── data model ──────────────────────────────────────────────────────────────
function shares(list) {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.name === 'string' && x.name.trim() && pos(num(x.percent)) !== null)
    .map((x) => ({ name: x.name.trim(), percent: Math.min(100, x.percent), totalSeconds: pos(num(x.totalSeconds)) }))
    .sort((a, b) => b.percent - a.percent)
}

function model(data) {
  const w = data?.wakatime
  if (!w || typeof w !== 'object' || (!w.allTime && !w.lastYear)) return null
  const all = w.allTime ?? {}
  const ly = w.lastYear ?? {}
  const allSec = pos(num(all.totalSeconds))
  const lySec = pos(num(ly.totalSeconds))
  const langs = shares(ly.languages)
  // Up to 7 named languages, then one "Other" row for everything else: WakaTime's
  // own "Other" bucket, named languages past the cut and any share the data does
  // not list (the collector keeps a top 10, a snapshot a top 5). The rows always
  // add up to the whole of tracked time, so the stacked bar has no empty track.
  // Shares are kept at the 0.1 % the list prints, so the printed rows sum to 100.0 %.
  const isOther = (l) => /^other$/i.test(l.name)
  const r1 = (v) => Math.round(v * 10) / 10
  const shown = langs.filter((l) => !isOther(l) && r1(l.percent) > 0).slice(0, MAX_LANGS - 1)
  const folded = langs.filter((l) => !shown.includes(l))
  const restPct = langs.length ? Math.max(0, r1(100 - shown.reduce((s, l) => s + r1(l.percent), 0))) : 0
  const listedRest = folded.reduce((s, l) => s + l.percent, 0)
  // hours of the rest: from the yearly total, or from the folded rows when they are the whole rest
  const restSec = lySec
    ? (lySec * restPct) / 100
    : folded.length && folded.every((l) => l.totalSeconds) && Math.abs(restPct - listedRest) < 0.05
      ? folded.reduce((s, l) => s + l.totalSeconds, 0)
      : null
  const top = shown.map((l, i) => ({
    ...l,
    percent: r1(l.percent),
    seconds: l.totalSeconds ?? (lySec ? (lySec * l.percent) / 100 : null),
    other: false,
    fill: rampColor(i, shown.length),
  }))
  if (restPct >= 0.05) top.push({ name: 'Other', percent: restPct, seconds: restSec, other: true, fill: '#5a5a5a' })
  return {
    allSec,
    lySec,
    since: monthYear(all.since),
    avgSec: pos(num(ly.dailyAverageSeconds)),
    langs: top,
    topLang: langs.find((l) => !isOther(l)) ?? langs[0] ?? null,
    editor: shares(ly.editors)[0] ?? null,
    os: shares(ly.operatingSystems)[0] ?? null,
  }
}


// ── icons ───────────────────────────────────────────────────────────────────
function langIconSpec(name) {
  const key = String(name).toLowerCase()
  if (hasIcon(LANG_ICON[key])) return { brand: LANG_ICON[key] }
  if (LANG_GLYPH[key] && hasGlyph(LANG_GLYPH[key])) return { glyph: LANG_GLYPH[key] }
  // unknown language: boxed monogram of its first letter/digit ("C#" → C, ".NET" → N)
  return { label: /[a-z0-9]/i.exec(String(name))?.[0]?.toUpperCase() ?? '?' }
}
function editorIconSpec(name) {
  return /(vs ?code|visual studio code)/i.test(name ?? '') ? { brand: 'visualstudiocode' } : { glyph: 'code' }
}
function osIconSpec(name) {
  if (/windows/i.test(name ?? '')) return { brand: 'windows' }
  if (/linux|ubuntu|debian|fedora|arch/i.test(name ?? '')) return { glyph: 'terminal' }
  return { glyph: 'monitor' }
}

// Small inline icon (16px): brand logo → UI glyph → boxed monogram.
function smallIcon(spec, x, y, size, fill) {
  if (spec.brand) return brandIcon(spec.brand, { x, y, size, fill })
  if (spec.glyph) return glyph(spec.glyph, { x, y, size, stroke: fill, strokeWidth: 1.6 })
  const letter = String(spec.label ?? '?').trim().charAt(0).toUpperCase() || '?'
  const s = size * 0.62
  return [
    h('rect', { x: x + 0.75, y: y + 0.75, width: size - 1.5, height: size - 1.5, rx: 4, stroke: fill, 'stroke-width': 1.25, opacity: 0.9 }),
    txt(x + size / 2, centerBaseline(y + size / 2, { size: s, weight: 600 }), letter, { size: s, weight: 600, fill, anchor: 'middle' }),
  ].join('')
}

// ── header ──────────────────────────────────────────────────────────────────
// Shared toolbar (DESIGN.md rule 1): WakaTime tile, title, period + the wakatime
// source's real freshness ("Snapshot" for the seed, never a hard-coded "Live").
function header(doc, f) {
  return panelHeader(doc, {
    icon: { brand: 'wakatime' },
    title: COPY.title,
    subtitle: COPY.subtitle,
    pills: [periodPill(COPY.range), freshnessPill(f)],
  }).markup
}

// ── KPI row ─────────────────────────────────────────────────────────────────
function kpiLabel(x, y, glyphName, text) {
  return [
    glyph(glyphName, { x, y: y - 11, size: 14, stroke: color.textTertiary, strokeWidth: 1.6 }),
    txt(x + 22, y, text.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary }),
  ]
}

// Big number with gray units: parts = [['5,186', 'h']] or [['7','h'],['16','m']].
// Numerals carry a faint top-lit gradient (white → #c8c8c8), the Geist display look.
function kpiValue(doc, x, y, parts) {
  if (!parts) return txt(x, y, '—', { ...KPI, fill: color.textTertiary })
  const paint = linearGradient(doc, `cd-num-${y}`, [
    [0, '#ffffff'],
    [1, '#bdbdbd'],
  ], { units: 'userSpaceOnUse', x1: 0, y1: y - 24, x2: 0, y2: y })
  const tspans = parts
    .map(([value, unit], i) =>
      h('tspan', { fill: `url(#${paint})`, dx: i ? 7 : null }, esc(value)) +
      h('tspan', { fill: color.textTertiary, 'font-size': UNIT.size, 'letter-spacing': '0em', dx: 2 }, esc(unit)),
    )
    .join('')
  return txt(x, y, '', { ...KPI, attrs: NUM, content: tspans })
}

function durationParts(seconds) {
  if (pos(seconds) === null) return null
  const total = Math.round(seconds / 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return hh ? [[String(hh), 'h'], [String(mm).padStart(2, '0'), 'm']] : [[String(mm), 'm']]
}

function kpis(doc, m, top) {
  const out = []
  const labelY = top + 38
  const valueY = top + 84
  const microY = top + 108 // centre line of the micro row
  const cell = (c) => ({ x: COLS[c] + PAD, w: COLS[c + 1] - COLS[c] - PAD * 2 })

  // 1 · total coding time — all time, with its "work-weeks" translation
  {
    const { x, w } = cell(0)
    const hrs = hoursText(m.allSec)
    out.push(kpiLabel(x, labelY, 'clock', COPY.total), kpiValue(doc, x, valueY, hrs ? [[hrs, 'h']] : null))
    const weeks = m.allSec ? Math.round(m.allSec / 3600 / 40) : null
    if (hrs) {
      const cap = [m.since ? `Since ${m.since}` : 'All time', weeks ? `≈ ${intFmt.format(weeks)} work-weeks` : null]
        .filter(Boolean)
        .join(' · ')
      out.push(txt(x, centerBaseline(microY, { size: 12 }), truncate(cap, w, { size: 12 }), { size: 12, fill: color.textSecondary }))
    }
  }

  // 2 · last 12 months — share of the all-time total as a meter
  {
    const { x, w } = cell(1)
    const hrs = hoursText(m.lySec)
    out.push(kpiLabel(x, labelY, 'calendar', COPY.lastYear), kpiValue(doc, x, valueY, hrs ? [[hrs, 'h']] : null))
    const share = m.lySec && m.allSec ? Math.min(1, m.lySec / m.allSec) : null
    const perWeek = m.lySec ? Math.round(m.lySec / 3600 / 52.18) : null
    if (hrs && perWeek) {
      // neutral chip (rule 5: not a delta), top-right of the tile on the label's centre line
      out.push(chip({ x: x + w, cy: labelY - 4, text: `≈ ${perWeek} h/wk`, align: 'end' }).markup)
    }
    if (share !== null) {
      const trackW = 64
      const meter = linearGradient(doc, 'cd-share', [
        [0, color.blue],
        [1, color.blueBright],
      ], { units: 'userSpaceOnUse', x1: x, y1: 0, x2: x + trackW, y2: 0 })
      const cap = `${Math.round(share * 100)}% of all-time hours`
      out.push(
        h('rect', { x, y: microY - 2, width: trackW, height: 4, rx: 2, fill: color.surface3 }),
        h('rect', { x, y: microY - 2, width: Math.max(4, r2(trackW * share)), height: 4, rx: 2, fill: `url(#${meter})` }),
        txt(x + trackW + 10, centerBaseline(microY, { size: 12 }), truncate(cap, w - trackW - 10, { size: 12 }), { size: 12, fill: color.textSecondary }),
      )
    }
  }

  // 3 · daily average — a 24-hour day meter, one cell per hour
  {
    const { x } = cell(2)
    const parts = durationParts(m.avgSec)
    out.push(kpiLabel(x, labelY, 'timer', COPY.daily), kpiValue(doc, x, valueY, parts))
    if (parts) {
      const hrs = Math.min(24, m.avgSec / 3600)
      const cw = 4
      const gap = 3
      const ch = 12
      const cells = []
      for (let i = 0; i < 24; i++) {
        const lit = Math.max(0, Math.min(1, hrs - i))
        const cxx = x + i * (cw + gap)
        cells.push(h('rect', { x: cxx, y: microY - ch / 2, width: cw, height: ch, rx: 1.5, fill: color.surface3 }))
        if (lit > 0) {
          const lh = r2(Math.max(2, ch * lit))
          cells.push(h('rect', { x: cxx, y: r2(microY + ch / 2 - lh), width: cw, height: lh, rx: 1.5, fill: 'url(#cd-day)' }))
        }
      }
      linearGradient(doc, 'cd-day', [
        [0, color.blueBright],
        [1, color.blue],
      ], { x1: 0, y1: 0, x2: 0, y2: 1 })
      const endX = x + 24 * (cw + gap) - gap
      out.push(cells, txt(endX + 10, centerBaseline(microY, { size: 12 }), 'of 24 h', { size: 12, fill: color.textSecondary }))
    }
  }
  return out
}

// ── identity row: language / editor / OS ────────────────────────────────────
function identity(doc, m, top) {
  const items = [
    { label: COPY.language, item: m.topLang, spec: m.topLang ? langIconSpec(m.topLang.name) : { glyph: 'code' } },
    { label: COPY.editor, item: m.editor, spec: m.editor ? editorIconSpec(m.editor.name) : { glyph: 'code' } },
    { label: COPY.os, item: m.os, spec: m.os ? osIconSpec(m.os.name) : { glyph: 'monitor' } },
  ]
  const TILE = 40
  const cy = top + ID_H / 2
  linearGradient(doc, 'cd-tile-fill', [
    [0, '#161616'],
    [1, color.surface],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  linearGradient(doc, 'cd-tile-stroke', [
    [0, '#4a4a4a'],
    [0.5, color.borderStrong],
    [1, color.border],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  return items.map(({ label, item, spec }, c) => {
    const x = COLS[c] + PAD
    const textX = x + TILE + 14
    const room = COLS[c + 1] - PAD - textX
    const name = item ? truncate(item.name, room, { size: 15, weight: 600 }) : '—'
    const share = item ? `${Math.round(item.percent)}% of coding time` : 'No data yet'
    return [
      iconTile(doc, {
        x,
        y: cy - TILE / 2,
        size: TILE,
        r: 10,
        iconSize: 20,
        iconColor: color.text,
        fill: 'url(#cd-tile-fill)',
        stroke: 'url(#cd-tile-stroke)',
        brand: spec.brand,
        glyph: spec.glyph,
        label: spec.label,
      }),
      txt(textX, cy - 9, label.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary }),
      txt(textX, cy + 10, name, { size: 15, weight: 600, tracking: -0.01, fill: item ? color.text : color.textTertiary }),
      txt(textX, cy + 27, truncate(share, room, { size: 12 }), { size: 12, fill: color.textSecondary }),
    ]
  })
}

// ── languages ───────────────────────────────────────────────────────────────
function languages(doc, m, top) {
  const out = []
  const left = PAD
  const right = W - PAD
  const fullW = right - left
  const titleY = top + 40
  // the rows cover all tracked time (see model); normalise so the bar fills exactly
  const total = m.langs.reduce((s, l) => s + l.percent, 0) || 100
  out.push(txt(left, titleY, COPY.languages.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary }))
  if (m.langs.length) {
    const named = m.langs.filter((l) => !l.other).length
    const grouped = m.langs.some((l) => l.other)
    const summary = !named
      ? 'Other · 100% of tracked time'
      : grouped
        ? `Top ${named} · rest grouped as Other`
        : `${named} ${named === 1 ? 'language' : 'languages'} · 100% of tracked time`
    out.push(txt(right, titleY, summary, { size: 12, fill: color.textTertiary, anchor: 'end' }))
  }

  if (!m.langs.length) {
    out.push(
      h('rect', { x: left + 0.5, y: top + 60.5, width: fullW - 1, height: BAR_H - 1, rx: BAR_H / 2, fill: 'none', stroke: color.borderStrong, 'stroke-dasharray': '3 3' }),
      txt(left, top + 104, 'Language breakdown appears after the next WakaTime sync.', { size: 13, fill: color.textTertiary }),
    )
    return { markup: out, height: 132 }
  }

  // stacked bar
  const barY = top + 60
  const barClip = doc.def('cd-bar-clip', h('clipPath', { id: 'cd-bar-clip' }, h('rect', { x: left, y: barY, width: fullW, height: BAR_H, rx: BAR_H / 2 })))
  doc.def(
    'cd-hatch',
    h(
      'pattern',
      { id: 'cd-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      h('rect', { width: 5, height: 5, fill: '#2a2a2a' }),
      h('path', { d: 'M0 0V5', stroke: '#6b6b6b', 'stroke-width': 1.6 }),
    ),
  )
  const segs = []
  let cum = 0
  m.langs.forEach((l, i) => {
    const x0 = left + (fullW * cum) / total
    cum += l.percent
    const x1 = i === m.langs.length - 1 ? right : left + (fullW * cum) / total
    const gapR = i < m.langs.length - 1 ? 2 : 0
    segs.push(
      h('rect', {
        x: r2(x0),
        y: barY,
        width: r2(Math.max(1, x1 - x0 - gapR)),
        height: BAR_H,
        fill: l.other ? 'url(#cd-hatch)' : l.fill,
      }),
    )
  })
  // soft Geist-blue light under the lead segment: a pre-blurred radial gradient
  // (an <img> SVG re-rasterises every frame, so no filters)
  const lead = m.langs[0]
  if (lead && !lead.other) {
    const halo = radialGradient(doc, 'cd-lead-halo', [
      [0, lead.fill, 0.32],
      [0.55, lead.fill, 0.1],
      [1, lead.fill, 0],
    ])
    const lw = Math.max(16, (fullW * lead.percent) / total)
    out.push(h('rect', { x: r2(left - 8), y: barY - 12, width: r2(lw + 16), height: BAR_H + 30, fill: `url(#${halo})` }))
  }
  out.push(
    h(
      'g',
      { 'clip-path': `url(#${barClip})` },
      h('rect', { x: left, y: barY, width: fullW, height: BAR_H, fill: color.surface3 }),
      segs,
      // top-edge light on the bar
      h('rect', { x: left, y: barY, width: fullW, height: BAR_H / 2, fill: '#ffffff', opacity: 0.07 }),
    ),
    // signature motion: a slow shine sweeping along the stacked bar (rests off-bar)
    shineSweep(doc, { x: left, y: barY, w: fullW, h: BAR_H, r: BAR_H / 2, duration: 8, delay: 3, angle: 24, opacity: 0.32, band: 120 }),
  )

  // list: icon + name | share bar on a 0–100 % track (quarter guides) | percent · hours
  const listTop = barY + BAR_H + 20
  const bx = left + NAME_COL
  const bw = right - VALUE_COL - bx
  const listH = m.langs.length * ROW_H
  const pctX = right - 76
  out.push(
    h('path', {
      d: [0.25, 0.5, 0.75].map((q) => `M${r2(bx + bw * q) + 0.5} ${listTop + 6}V${listTop + listH - 6}`).join(''),
      stroke: color.border,
      'stroke-dasharray': '2 3',
    }),
  )
  m.langs.forEach((l, i) => {
    const y = listTop + i * ROW_H
    const cy = y + ROW_H / 2
    const spec = langIconSpec(l.name)
    const fillW = Math.max(3, (bw * l.percent) / 100)
    if (i) out.push(h('path', { d: `M${left} ${y + 0.5}H${right}`, stroke: '#141414' }))
    out.push(
      smallIcon(spec, left, cy - 8, 16, l.other ? color.textSecondary : color.text),
      txt(left + 28, centerBaseline(cy, { size: 13, weight: 500 }), truncate(l.name, NAME_COL - 44, { size: 13, weight: 500 }), {
        size: 13,
        weight: 500,
        fill: l.other ? color.textSecondary : color.text,
      }),
      h('rect', { x: bx, y: cy - 3, width: bw, height: 6, rx: 3, fill: color.surface2 }),
      h('rect', { x: bx, y: cy - 3, width: r2(fillW), height: 6, rx: 3, fill: l.other ? 'url(#cd-hatch)' : l.fill }),
      txt(pctX, centerBaseline(cy, { size: 13, family: 'mono' }), pctText(l.percent), { size: 13, family: 'mono', fill: color.text, anchor: 'end', attrs: NUM }),
    )
    const hrs = hoursText(l.seconds)
    if (hrs) {
      out.push(txt(right, centerBaseline(cy, { size: 13, family: 'mono' }), `${hrs} h`, { size: 13, family: 'mono', fill: color.textTertiary, anchor: 'end', attrs: NUM }))
    }
  })
  return { markup: out, height: listTop - top + listH + 20 }
}

// ── empty state ─────────────────────────────────────────────────────────────
function emptyState(doc, top, height) {
  const cx = W / 2
  const cy = top + height / 2 - 14
  return [
    iconTile(doc, { x: cx - 20, y: cy - 44, size: 40, r: 10, glyph: 'clock', iconSize: 20, iconColor: color.textSecondary, fill: color.surface }),
    txt(cx, cy + 20, COPY.emptyTitle, { size: 16, weight: 600, tracking: -0.01, fill: color.text, anchor: 'middle' }),
    txt(cx, cy + 42, COPY.emptyText, { size: 13, fill: color.textTertiary, anchor: 'middle' }),
    // ghost skeleton of the language bar
    [0.34, 0.12, 0.08, 0.05].map((p, i, arr) => {
      const total = 360
      const x0 = cx - total / 2 + arr.slice(0, i).reduce((s, v) => s + v * total * 2, 0)
      return h('rect', { x: r2(x0), y: cy + 66, width: r2(p * total * 2 - 4), height: 6, rx: 3, fill: color.surface3 })
    }),
  ]
}

// ── assembly ────────────────────────────────────────────────────────────────
function describe(m, f) {
  if (!m) return 'Coding activity from WakaTime: no data available yet.'
  const parts = []
  const all = hoursText(m.allSec)
  const ly = hoursText(m.lySec)
  if (all) parts.push(`total coding time ${all} hours`)
  if (ly) parts.push(`${ly} hours in the last 12 months`)
  const avg = durationParts(m.avgSec)
  if (avg) parts.push(`daily average ${avg.map(([v, u]) => `${v}${u}`).join(' ')}`)
  if (m.topLang) parts.push(`top language ${m.topLang.name} (${Math.round(m.topLang.percent)}%)`)
  if (m.editor) parts.push(`editor ${m.editor.name}`)
  if (m.os) parts.push(`operating system ${m.os.name}`)
  const langs = m.langs.map((l) => `${l.name} ${pctText(l.percent)}`).join(', ')
  return `Coding activity from WakaTime (${f.label.toLowerCase()}): ${parts.join('; ')}.${langs ? ` Languages, last 12 months: ${langs}.` : ''}`
}

// Provenance strip (rule 4): source + its state, and the work-week basis.
function footnote(doc, f, m, y) {
  const tail = f.state === 'seed' ? 'dashboard snapshot' : f.date ? `synced ${f.date}` : null
  return panelFooter(doc, {
    y,
    left: [['Source', [COPY.source, tail].filter(Boolean).join(' · ')]],
    right: m?.allSec ? [['Basis', COPY.basis]] : [],
  }).markup
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

function render(data) {
  const m = model(data)
  const f = freshness(data, 'wakatime')

  // vertical layout
  const kpiTop = HEADER_H
  const idTop = kpiTop + KPI_H
  const langTop = idTop + ID_H
  const EMPTY_H = 220
  let langBlock = null
  const probe = createDoc({ width: W, height: 1, title: '' })
  if (m) langBlock = languages(probe, m, langTop)
  const bodyBottom = m ? langTop + langBlock.height : HEADER_H + EMPTY_H
  const H = bodyBottom + FOOT_H

  const doc = createDoc({ width: W, height: H, title: 'RunyShark — coding activity (WakaTime)', desc: describe(m, f) })
  const clip = panelClip(doc)

  // Motion is decoration only (DESIGN.md rule 6, v2): every data mark is drawn in
  // its final state, so a renderer that freezes animations still shows the full
  // card. Ambient: header starfield + a slow amber border beam; signature: the
  // shine sweeping the language bar.

  // atmosphere: amber light at the top edge + a dot grid fading out from it
  const glow = radialGradient(doc, 'cd-glow', [
    [0, color.amber, 0.18],
    [0.45, color.amber, 0.045],
    [1, color.amber, 0],
  ])
  doc.def(
    'cd-dots',
    h(
      'pattern',
      { id: 'cd-dots', width: 12, height: 12, patternUnits: 'userSpaceOnUse', x: 6, y: 6 },
      h('circle', { cx: 6, cy: 6, r: 0.85, fill: '#ffffff', 'fill-opacity': 0.2 }),
    ),
  )
  const fade = radialGradient(doc, 'cd-dots-fade', [
    [0, '#ffffff', 1],
    [0.55, '#ffffff', 0.3],
    [1, '#ffffff', 0],
  ])
  doc.def(
    'cd-dots-mask',
    h(
      'mask',
      { id: 'cd-dots-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: HEADER_H },
      h('ellipse', { cx: W * 0.62, cy: 0, rx: 380, ry: 120, fill: `url(#${fade})` }),
    ),
  )
  const edge = linearGradient(doc, 'cd-edge', [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', 0.24],
    [1, '#ffffff', 0],
  ], { units: 'userSpaceOnUse', x1: 16, y1: 0, x2: W - 16, y2: 0 })
  const headTextW = Math.max(measure(COPY.title, TYPE.title), measure(COPY.subtitle, TYPE.subtitle))
  const stars = starfield(doc, {
    x: 8,
    y: 4,
    w: W - 16,
    h: HEADER_H - 8,
    count: 36,
    seed: 'coding',
    flares: 2,
    opacity: 0.8,
    avoid: [
      { x: PAD - 8, y: 8, w: 28 + 12 + headTextW + 20, h: HEADER_H - 16 }, // tile + title block
      { x: W - PAD - 290, y: HEADER_H / 2 - 18, w: 296, h: 36 }, // period + status pills
    ],
  })
  const atmosphere = [
    h('ellipse', { cx: W * 0.62, cy: 0, rx: 380, ry: 150, fill: `url(#${glow})` }),
    stars,
    h('rect', { x: 0, y: 0, width: W, height: HEADER_H, fill: 'url(#cd-dots)', mask: 'url(#cd-dots-mask)' }),
    h('path', { d: `M16 0.5H${W - 16}`, stroke: `url(#${edge})` }),
  ]

  // guides
  // the toolbar and footer draw their own hairlines (63.5 and bodyBottom + 0.5)
  const hLines = m ? [idTop, langTop] : []
  const guides = [h('path', { d: hLines.map((y) => `M0 ${y + 0.5}H${W}`).join(''), stroke: color.border })]
  if (m) {
    guides.push(h('path', { d: [COLS[1], COLS[2]].map((x) => `M${x + 0.5} ${HEADER_H}V${langTop}`).join(''), stroke: color.border }))
    for (const x of [COLS[1], COLS[2]]) for (const y of [HEADER_H - 1, idTop, langTop]) guides.push(crosshair(x + 0.5, y + 0.5, { stroke: color.borderHover }))
  }

  const body = m
    ? [kpis(doc, m, kpiTop), identity(doc, m, idTop), languages(doc, m, langTop).markup]
    : emptyState(doc, HEADER_H, EMPTY_H)

  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, atmosphere, guides),
    header(doc, f),
    body,
    footnote(doc, f, m, bodyBottom),
    beam(doc, { x: 0, y: 0, w: W, h: H, r: 16, color: color.amber, duration: 15, delay: 11, length: 55, width: 1.25 }),
  )
}

export default {
  name: 'coding',
  render({ data } = {}) {
    return [{ path: 'assets/generated/coding.svg', svg: render(data ?? {}) }]
  },
}
