// Coding activity (WakaTime) — a Vercel-dashboard panel in one SVG.
//
//   ┌ ◉ Coding activity ────────────────────────── [▣ Last 12 months] [● Live] ┐
//   ├──────────────┼──────────────┼──────────────┤
//   │ TOTAL        │ LAST 12 MO   │ DAILY AVG    │  numbers + one micro-visual each
//   ├──────────────┼──────────────┼──────────────┤
//   │ [TS] lang    │ [VS] editor  │ [⊞] OS       │  icon tile + label + name + share
//   ├──────────────┴──────────────┴──────────────┤
//   │ LANGUAGES         Top 4 · rest grouped as Other │
//   │ ████████████████████▌██▌█▌▌▒▒▒▒▒  stacked bar │  always 100 %: "Other" closes it
//   │ ▓▓▓▓▓▓▓▓▓▓▓▓ TypeScript           55.0%  1,397 h │  Vercel-Analytics rows
//   ├────────────────────────────────────────────┤
//   │ Source: WakaTime · last 12 months · snapshot │
//
// Data: data.wakatime (DESIGN.md §6). Every field may be missing; with no
// WakaTime block at all the panel renders an empty state instead.

import { glyph, hasGlyph } from '../core/glyphs.mjs'
import { brandIcon, hasIcon } from '../core/icons.mjs'
import { crosshair, iconTile, linearGradient, pill, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color, gradient, layout } from '../core/tokens.mjs'

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
  source: 'Source: WakaTime · last 12 months',
}
const STATUS = {
  live: { text: 'Live', dot: color.greenBright, pulse: true },
  cache: { text: 'Cached', dot: color.textTertiary, pulse: false },
  seed: { text: 'Snapshot', dot: color.textTertiary, pulse: false },
  none: { text: 'No data', dot: color.textMuted, pulse: false },
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
const HEADER_H = 88
const KPI_H = 136
const ID_H = 100
const ROW_H = 36
const NAME_COL = 176 // icon + language name
const BAR_H = 10
const FOOT_H = 48
const MAX_LANGS = 8 // list rows, "Other" included
const VALUE_COL = 168 // right column of the language list (percent + hours)

const MONO_LABEL = { size: 11, weight: 400, family: 'mono', tracking: 0.08 }
const KPI = { size: 32, weight: 600, tracking: -0.04 }
const UNIT = { size: 16, weight: 500, tracking: -0.01 }
const NUM = { style: 'font-variant-numeric:tabular-nums' }

// ── helpers ─────────────────────────────────────────────────────────────────
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const pos = (v) => (num(v) !== null && v > 0 ? v : null)
const r2 = (v) => Math.round(v * 100) / 100
const intFmt = new Intl.NumberFormat('en-US')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Deterministic 0..1 hash (no Math.random: output must be byte-stable).
function hash(a, b = 0, salt = 0) {
  let x = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(salt + 1, 362437)) | 0
  x = Math.imul(x ^ (x >>> 15), 2246822519)
  x = Math.imul(x ^ (x >>> 13), 3266489917)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

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
// '2026-10-22T05:00:00Z' → 'Oct 22, 2026'
function dayText(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
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

function statusOf(data, m) {
  if (!m) return STATUS.none
  const src = data?.sources?.wakatime
  return STATUS[src] ?? STATUS.cache
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
// Halftone orb (pixelated-canvas texture) in Vercel's "Develop" gradient — the
// avatar of the card, with a WakaTime badge where the reference has its amber one.
function orb(doc, cx, cy, R) {
  const fill = linearGradient(doc, 'cd-orb-fill', [
    [0, gradient.develop[0]],
    [1, gradient.develop[1]],
  ], { units: 'userSpaceOnUse', x1: cx - R, y1: cy + R, x2: cx + R, y2: cy - R })
  const step = 3
  const n = Math.ceil(R / step) + 1
  const still = []
  const twinkle = [[], [], []]
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const x = i * step + (j % 2 ? step / 2 : 0)
      const y = j * step * 0.88
      const d = Math.hypot(x, y) / R
      if (d > 0.97) continue
      const z = Math.sqrt(1 - d * d)
      const light = Math.max(0, (-0.5 * x) / R + (-0.58 * y) / R + 0.66 * z)
      const v = 0.14 + 0.86 * light
      if (hash(i + 40, j + 40, 7) < 0.04 + (1 - v) * 0.4) continue // dropout
      const r = 0.28 + 1.02 * v
      const dot = `M${r2(cx + x - r)} ${r2(cy + y)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`
      const roll = hash(i + 40, j + 40, 9)
      if (roll < 0.12) twinkle[Math.floor(roll * 25) % 3].push(dot)
      else still.push(dot)
    }
  }
  doc.css(`@keyframes cd-tw{0%,100%{opacity:1}50%{opacity:.2}}
.cd-tw1{animation:cd-tw 4.8s ease-in-out infinite}
.cd-tw2{animation:cd-tw 6.4s ease-in-out 1.2s infinite}
.cd-tw3{animation:cd-tw 8s ease-in-out 2.6s infinite}`)
  const dots = [
    h('path', { d: still.join(''), fill: `url(#${fill})` }),
    twinkle.map((list, k) => (list.length ? h('path', { d: list.join(''), fill: `url(#${fill})`, class: `cd-tw${k + 1}` }) : '')),
  ]
  const halo = radialGradient(doc, 'cd-orb-halo', [
    [0, gradient.develop[0], 0.28],
    [0.6, gradient.develop[0], 0.06],
    [1, gradient.develop[0], 0],
  ])
  const B = 16 // badge
  const bx = cx + R * 0.72
  const by = cy + R * 0.72
  return [
    h('circle', { cx, cy, r: R * 1.9, fill: `url(#${halo})` }),
    h('circle', { cx, cy, r: R + 0.5, fill: color.bg, stroke: color.border }),
    dots,
    h('circle', { cx: bx, cy: by, r: B / 2 + 2, fill: color.bg }),
    h('circle', { cx: bx, cy: by, r: B / 2, fill: color.text }),
    brandIcon('wakatime', { x: bx - 5.5, y: by - 5.5, size: 11, fill: color.bg }),
  ]
}

function rangePill(x, y, text) {
  const size = 12
  const H = 28
  const tw = measure(text, { size, weight: 500 })
  const w = 10 + 14 + 7 + tw + 12
  const left = x - w
  return {
    width: w,
    markup: [
      h('rect', { x: left + 0.5, y: y + 0.5, width: w - 1, height: H - 1, rx: 6, fill: color.surface, stroke: color.borderStrong }),
      glyph('calendar', { x: left + 10, y: y + 7, size: 14, stroke: color.textTertiary, strokeWidth: 1.6 }),
      txt(left + 31, centerBaseline(y + H / 2, { size, weight: 500 }), text, { size, weight: 500, fill: color.textSecondary }),
    ].join(''),
  }
}

function header(doc, status) {
  const cy = HEADER_H / 2
  const R = 22
  const textX = PAD + R * 2 + 16
  const st = pill(doc, {
    x: W - PAD,
    y: cy - 14,
    height: 28,
    size: 12,
    text: status.text,
    dot: status.dot,
    pulse: status.pulse,
    align: 'end',
    padX: 11,
  })
  const range = rangePill(W - PAD - st.width - 8, cy - 14, COPY.range)
  return [
    orb(doc, PAD + R, cy, R),
    txt(textX, cy - 3, COPY.title, { size: 16, weight: 600, tracking: -0.01, fill: color.text }),
    txt(textX, cy + 15, COPY.subtitle, { size: 13, fill: color.textTertiary }),
    range.markup,
    st.markup,
  ]
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
  if (!parts) return txt(x, y, '—', { ...KPI, fill: color.textMuted })
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
      // Vercel delta-chip, top-right of the tile on the label's centre line
      const text = `≈ ${perWeek} h/wk`
      const cw = measure(text, { size: 12, weight: 500 }) + 16
      const cy = labelY - 4
      out.push(
        h('rect', { x: x + w - cw + 0.5, y: cy - 10, width: cw - 1, height: 20, rx: 10, fill: color.blueDeep, 'fill-opacity': 0.6, stroke: color.blue, 'stroke-opacity': 0.5 }),
        txt(x + w - cw / 2, centerBaseline(cy, { size: 12, weight: 500 }), text, { size: 12, weight: 500, fill: color.blueBright, anchor: 'middle', attrs: NUM }),
      )
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
      txt(textX, cy + 10, name, { size: 15, weight: 600, tracking: -0.01, fill: item ? color.text : color.textMuted }),
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
  const sheen = linearGradient(doc, 'cd-sheen', [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', 0.55],
    [1, '#ffffff', 0],
  ], { x1: 0, y1: 0, x2: 1, y2: 0 })
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
  // soft Geist-blue light under the lead segment (one cheap blur for the whole SVG)
  const lead = m.langs[0]
  if (lead && !lead.other) {
    doc.def(
      'cd-blur',
      h('filter', { id: 'cd-blur', x: '-20%', y: '-200%', width: '140%', height: '500%' }, h('feGaussianBlur', { stdDeviation: 6 })),
    )
    out.push(
      h('rect', {
        x: left + 8,
        y: barY + 2,
        width: r2(Math.max(8, (fullW * lead.percent) / total - 16)),
        height: BAR_H,
        rx: BAR_H / 2,
        fill: lead.fill,
        opacity: 0.4,
        filter: 'url(#cd-blur)',
      }),
    )
  }
  out.push(
    h(
      'g',
      { 'clip-path': `url(#${barClip})` },
      h('rect', { x: left, y: barY, width: fullW, height: BAR_H, fill: color.surface3 }),
      segs,
      // top-edge light on the bar, then a slow sheen sweeping across it
      h('rect', { x: left, y: barY, width: fullW, height: BAR_H / 2, fill: '#ffffff', opacity: 0.07 }),
      h('rect', { x: left - 140, y: barY, width: 120, height: BAR_H, fill: `url(#${sheen})`, opacity: 0.35, class: 'cd-sheen' }),
    ),
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
function describe(m, status) {
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
  return `Coding activity from WakaTime (${status.text.toLowerCase()}): ${parts.join('; ')}.${langs ? ` Languages, last 12 months: ${langs}.` : ''}`
}

function footnote(data, m, y) {
  const src = data?.sources?.wakatime
  const synced = (src === 'live' || src === 'cache') && dayText(data?.generatedAt)
  const tail = src === 'seed' ? 'dashboard snapshot' : src === 'live' ? 'live' : src === 'cache' ? 'cached' : null
  const left = [COPY.source, tail, synced ? `synced ${synced}` : null].filter(Boolean).join(' · ')
  // methodology note for the work-weeks translation in the first KPI
  const right = m?.allSec ? '1 work-week = 40 h' : ''
  const base = centerBaseline(y, { size: 11, family: 'mono' })
  const rightW = right ? measure(right, { size: 11, family: 'mono' }) + 24 : 0
  return [
    txt(PAD, base, truncate(left, W - PAD * 2 - rightW, { size: 11, family: 'mono' }), { size: 11, family: 'mono', fill: color.textTertiary }),
    right ? txt(W - PAD, base, right, { size: 11, family: 'mono', fill: color.textTertiary, anchor: 'end' }) : '',
  ]
}

function render(data) {
  const m = model(data)
  const status = statusOf(data, m)

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

  const doc = createDoc({ width: W, height: H, title: 'RunyShark — coding activity (WakaTime)', desc: describe(m, status) })
  const clip = panelClip(doc)

  // Motion is decoration only: every data mark is drawn in its final state, so a
  // renderer that freezes animations still shows the full card.
  doc.css(`@keyframes cd-sheen{0%,55%{transform:translateX(0)}100%{transform:translateX(${W + 40}px)}}
.cd-sheen{animation:cd-sheen 9s cubic-bezier(.4,0,.2,1) 2s infinite}`)

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
  const atmosphere = [
    h('ellipse', { cx: W * 0.62, cy: 0, rx: 380, ry: 150, fill: `url(#${glow})` }),
    h('rect', { x: 0, y: 0, width: W, height: HEADER_H, fill: 'url(#cd-dots)', mask: 'url(#cd-dots-mask)' }),
    h('path', { d: `M16 0.5H${W - 16}`, stroke: `url(#${edge})` }),
  ]

  // guides
  const hLines = m ? [HEADER_H, idTop, langTop, bodyBottom] : [HEADER_H, bodyBottom]
  const guides = [h('path', { d: hLines.map((y) => `M0 ${y + 0.5}H${W}`).join(''), stroke: color.border })]
  if (m) {
    guides.push(h('path', { d: [COLS[1], COLS[2]].map((x) => `M${x + 0.5} ${HEADER_H}V${langTop}`).join(''), stroke: color.border }))
    for (const x of [COLS[1], COLS[2]]) for (const y of [HEADER_H, idTop, langTop]) guides.push(crosshair(x + 0.5, y + 0.5, { stroke: color.textMuted }))
  }

  const body = m
    ? [kpis(doc, m, kpiTop), identity(doc, m, idTop), languages(doc, m, langTop).markup]
    : emptyState(doc, HEADER_H, EMPTY_H)

  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, atmosphere, guides),
    header(doc, status),
    body,
    footnote(data, m, bodyBottom + FOOT_H / 2),
  )
}

export default {
  name: 'coding',
  render({ data } = {}) {
    return [{ path: 'assets/generated/coding.svg', svg: render(data ?? {}) }]
  },
}
