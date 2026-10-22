// Tech stack panel — a design-system / integrations-marketplace page in one SVG.
//
//   ┌ header ─ eyebrow · two-tone headline · subline ─────────── core logo stack ┐
//   ├ DOMAIN ───────────┼ TECHNOLOGIES ─────────────────────────────────────────┤
//   │ 01 LANGUAGES      │ [◆ TypeScript] [◆ JavaScript] [◆ Python]              │
//   │ ▬▬──────── 3      │                                                       │
//   ├───────────────────┼───────────────────────────────────────────────────────┤
//   │ 02 FRONTEND …     │ chips flow and wrap on measured widths …              │
//
// Static: copy comes from content.stack; `data` is accepted but not needed.

import { stack } from '../content.mjs'
import { glyph, hasGlyph } from '../core/glyphs.mjs'
import { brandIcon, hasIcon, iconInfo } from '../core/icons.mjs'
import { crosshair, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, esc, h, panel, panelClip } from '../core/svg.mjs'
import { capHeight, centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'

// ── copy that content.mjs does not carry ────────────────────────────────────
const COPY = {
  eyebrow: 'Toolchain',
  subline: 'Monochrome by design. Versions pinned where they matter.',
  colDomain: 'Domain',
  colItems: 'Technologies',
  core: 'Core stack',
}
// Core stack (content.stack item names): shown as the header's overlapping logo
// discs and lifted with a brighter edge in the grid. Missing names are skipped.
const CORE = ['TypeScript', 'React 19', 'Next.js 15', 'NestJS 11', 'Expo 54', 'Prisma 7']

// Logos whose simple-icons path does not read at 16px get a crop: the icon is
// zoomed to `box` [x, y, size] (24-unit space), clipped to `clip`, and optionally
// thickened with a same-colour stroke. MySQL's path is the wordmark + dolphin;
// only the dolphin survives at chip size.
const ICON_CROP = {
  mysql: { box: [13.6, 3.2, 10.6], clip: [13.6, 3.2, 10.6, 9.4], stroke: 0.6 },
}

// ── geometry ────────────────────────────────────────────────────────────────
const W = layout.width
const PAD = layout.pad // 32
const COL = 224 // x of the column guide
const GUTTER = 24
const X0 = COL + GUTTER // chips start
const X1 = W - PAD // chips end
const LABEL_X = PAD + 24 // category label (after the index number)
const LABEL_R = COL - GUTTER // right edge of the label cell

const HEADER_H = 136
const THEAD_H = 40
const CELL_PAD = 24
const CHIP_H = 32
const CHIP_R = 8
const CHIP_GAP = 8
const ROW_GAP = 8
const ICON = 16
const CHIP_PAD_L = 10
const CHIP_PAD_R = 12
const ICON_GAP = 8
const VERSION_GAP = 5
const METER_DY = 18 // label baseline → meter centre

const NAME = { size: 13, weight: 500 }
const VERSION = { size: 12, weight: 400, family: 'mono' }
const MONO_LABEL = { size: 12, weight: 400, family: 'mono', tracking: 0.08 }
const MONO_SMALL = { size: 11, weight: 400, family: 'mono', tracking: 0.08 }

// "React 19" → { base: 'React', version: '19' }; "Tailwind CSS v4" → v4.
function splitVersion(name) {
  const m = /^(.*\S)\s+(v?\d[\w.]*)$/.exec(String(name ?? '').trim())
  return m ? { base: m[1], version: m[2] } : { base: String(name ?? '').trim(), version: '' }
}

function chipMetrics(item) {
  const { base: raw, version } = splitVersion(item.name)
  const versionW = version ? measure(version, VERSION) : 0
  // never wider than the chip area: truncate pathological names
  const room = X1 - X0 - (CHIP_PAD_L + ICON + ICON_GAP + CHIP_PAD_R) - (version ? VERSION_GAP + versionW : 0)
  const base = truncate(raw, room, NAME)
  const baseW = measure(base, NAME)
  const width = Math.ceil(CHIP_PAD_L + ICON + ICON_GAP + baseW + (version ? VERSION_GAP + versionW : 0) + CHIP_PAD_R)
  return { base, version, baseW, width }
}

// Greedy flow with orphan control: a lone chip on the last row pulls one
// chip down from the row above so wraps never end on a single item.
function flow(chips, maxWidth) {
  const rows = [[]]
  let used = 0
  for (const chip of chips) {
    const row = rows.at(-1)
    const need = (row.length ? CHIP_GAP : 0) + chip.width
    if (row.length && used + need > maxWidth) {
      rows.push([chip])
      used = chip.width
    } else {
      row.push(chip)
      used += need
    }
  }
  const last = rows.at(-1)
  const prev = rows.at(-2)
  if (prev && last.length === 1 && prev.length >= 3) {
    const moved = prev.pop()
    const width = moved.width + CHIP_GAP + last[0].width
    if (width <= maxWidth) last.unshift(moved)
    else prev.push(moved)
  }
  return rows
}

function croppedIcon(doc, slug, x, y, size, fill) {
  const crop = ICON_CROP[slug]
  const info = iconInfo(slug)
  const [bx, by, bs] = crop.box
  const [cx, cy, cw, ch] = crop.clip
  const id = doc.def(`crop-${slug}`, h('clipPath', { id: `crop-${slug}` }, h('rect', { x: cx, y: cy, width: cw, height: ch })))
  const k = Math.round((size / bs) * 1000) / 1000
  return h(
    'g',
    { transform: `translate(${x} ${y}) scale(${k}) translate(${-bx} ${-by})` },
    h('path', {
      d: info.path,
      fill,
      stroke: crop.stroke ? fill : null,
      'stroke-width': crop.stroke || null,
      'stroke-linejoin': crop.stroke ? 'round' : null,
      'clip-path': `url(#${id})`,
    }),
  )
}

// Item icon: brand logo → UI glyph → boxed monogram.
function itemIcon(doc, item, x, y, size, fill) {
  if (hasIcon(item.icon) && ICON_CROP[item.icon]) return croppedIcon(doc, item.icon, x, y, size, fill)
  if (hasIcon(item.icon)) return brandIcon(item.icon, { x, y, size, fill })
  if (item.glyph && hasGlyph(item.glyph)) return glyph(item.glyph, { x, y, size, stroke: fill, strokeWidth: 1.6 })
  const letter = String(item.name ?? '?').trim().charAt(0).toUpperCase() || '?'
  const s = size * 0.62
  return [
    h('rect', { x: x + 0.75, y: y + 0.75, width: size - 1.5, height: size - 1.5, rx: 4, stroke: fill, 'stroke-width': 1.25, opacity: 0.9 }),
    txt(x + size / 2, centerBaseline(y + size / 2, { size: s, weight: 600 }), letter, { size: s, weight: 600, fill, anchor: 'middle' }),
  ].join('')
}

function chip(doc, chipM, item, x, y, core = false) {
  const cy = y + CHIP_H / 2
  const textX = x + CHIP_PAD_L + ICON + ICON_GAP
  const base = centerBaseline(cy, NAME)
  return h(
    'g',
    {},
    h('rect', {
      x: x + 0.5,
      y: y + 0.5,
      width: chipM.width - 1,
      height: CHIP_H - 1,
      rx: CHIP_R,
      fill: core ? 'url(#chip-fill-core)' : 'url(#chip-fill)',
      stroke: core ? 'url(#chip-stroke-core)' : 'url(#chip-stroke)',
    }),
    itemIcon(doc, item, x + CHIP_PAD_L, cy - ICON / 2, ICON, color.text),
    txt(textX, base, chipM.base, { ...NAME, fill: color.text }),
    chipM.version
      ? txt(textX + chipM.baseW + VERSION_GAP, base, chipM.version, { ...VERSION, fill: color.textTertiary })
      : '',
  )
}

function coreItems(categories) {
  const items = categories.flatMap((c) => c.items)
  return CORE.map((name) => items.find((it) => it.name === name)).filter(Boolean)
}

function coreStack(doc, categories, right, cy) {
  const items = categories.flatMap((c) => c.items)
  const slugs = coreItems(categories).map((it) => it.icon).filter((slug) => hasIcon(slug))
  const rest = items.length - slugs.length
  const D = 36
  const STEP = 30
  const restLabel = rest > 0 ? `+${rest}` : ''
  const count = slugs.length + (restLabel ? 1 : 0)
  if (!count) return ''
  const left = right - (D + (count - 1) * STEP)
  const ring = linearGradient(doc, 'core-ring', [
    [0, color.borderHover],
    [1, color.border],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  const parts = []
  const disc = (i, inner) => {
    const cx = left + i * STEP + D / 2
    parts.push(
      h('circle', { cx, cy, r: D / 2 + 1.5, fill: color.bg }),
      h('circle', { cx, cy, r: D / 2 - 0.5, fill: color.surface, stroke: `url(#${ring})` }),
      inner(cx),
    )
  }
  slugs.forEach((slug, i) => disc(i, (cx) => brandIcon(slug, { x: cx - 8, y: cy - 8, size: 16, fill: color.text })))
  if (restLabel) {
    disc(slugs.length, (cx) =>
      txt(cx, centerBaseline(cy, { size: 12, family: 'mono' }), restLabel, {
        size: 12,
        family: 'mono',
        fill: color.textSecondary,
        anchor: 'middle',
        attrs: { style: 'font-variant-numeric:tabular-nums' },
      }),
    )
  }
  return { markup: parts.join(''), left }
}

function render() {
  const categories = (Array.isArray(stack) ? stack : [])
    .map((c) => ({ title: String(c?.title ?? ''), items: (c?.items ?? []).filter((it) => it && it.name) }))
    .filter((c) => c.title && c.items.length)
  const total = categories.reduce((n, c) => n + c.items.length, 0)
  const coreSet = new Set(coreItems(categories))
  const maxCount = Math.max(1, ...categories.map((c) => c.items.length))

  // Lay out every category first so the canvas height is exact.
  let y = HEADER_H + THEAD_H
  const blocks = categories.map((cat, index) => {
    const chips = cat.items.map((item) => ({ item, ...chipMetrics(item) }))
    const rows = flow(chips, X1 - X0)
    const chipsH = rows.length * CHIP_H + (rows.length - 1) * ROW_GAP
    // the label cell (label centred on the first chip row + meter) sets a floor
    const labelCell = CHIP_H / 2 + capHeight(MONO_LABEL) / 2 + METER_DY + 1
    // whole pixels: every row rule (and the panel's bottom border) lands on the pixel grid
    const height = Math.ceil(CELL_PAD * 2 + Math.max(chipsH, labelCell))
    const block = { cat, index, rows, top: y, height }
    y += height
    return block
  })
  const H = y

  const desc = `Tech stack: ${total} technologies across ${categories.length} domains. ${categories
    .map((c) => `${c.title}: ${c.items.map((it) => it.name).join(', ')}.`)
    .join(' ')}`
  const doc = createDoc({ width: W, height: H, title: 'RunyShark — tech stack', desc })

  // shared paints
  linearGradient(doc, 'chip-fill', [
    [0, '#101010'],
    [1, color.surface],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  linearGradient(doc, 'chip-stroke', [
    [0, color.borderStrong],
    [1, color.border],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  linearGradient(doc, 'chip-fill-core', [
    [0, '#161616'],
    [1, color.surface],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  linearGradient(doc, 'chip-stroke-core', [
    [0, '#5e5e5e'],
    [0.5, color.borderStrong],
    [1, color.border],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  const glow = radialGradient(doc, 'stack-glow', [
    [0, color.amber, 0.13],
    [0.45, color.amber, 0.035],
    [1, color.amber, 0],
  ])
  const meter = linearGradient(doc, 'meter-fill', [
    [0, color.textTertiary],
    [1, color.text],
  ], { units: 'userSpaceOnUse', x1: LABEL_X, y1: 0, x2: LABEL_R - 28, y2: 0 })
  const clip = panelClip(doc)

  // ── header ────────────────────────────────────────────────────────────────
  const DISC_CY = 76 // optical centre of the 24px headline (baseline 84)
  const core = coreStack(doc, categories, X1, DISC_CY)
  const head1 = `${total} technologies`
  const head2 = ` across ${categories.length} domains`
  const headStyle = { size: 24, weight: 600, tracking: -0.03 }
  const headline = txt(PAD, 84, '', {
    ...headStyle,
    content: `${h('tspan', { fill: color.text }, esc(head1))}${h('tspan', { fill: color.textTertiary }, esc(head2))}`,
  })
  // Vercel grid scaffolding behind the core stack: 24px cells aligned to the
  // column guide and the header rule, faded out with a radial mask.
  const focusX = core ? (core.left + X1) / 2 : W - 200
  const focusY = DISC_CY
  doc.def(
    'hdr-grid',
    h(
      'pattern',
      { id: 'hdr-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse', x: COL % 24, y: HEADER_H % 24 },
      h('path', { d: 'M0.5 0V24M0 0.5H24', stroke: '#ffffff', 'stroke-opacity': 0.07 }),
    ),
  )
  const fade = radialGradient(doc, 'hdr-fade', [
    [0, '#ffffff', 1],
    [0.6, '#ffffff', 0.35],
    [1, '#ffffff', 0],
  ])
  doc.def(
    'hdr-mask',
    h(
      'mask',
      { id: 'hdr-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: HEADER_H },
      h('ellipse', { cx: focusX, cy: focusY, rx: 300, ry: 150, fill: `url(#${fade})` }),
    ),
  )
  const edge = linearGradient(doc, 'panel-edge', [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', 0.24],
    [1, '#ffffff', 0],
  ], { units: 'userSpaceOnUse', x1: 16, y1: 0, x2: W - 16, y2: 0 })
  const header = [
    h('ellipse', { cx: focusX, cy: 0, rx: 340, ry: 170, fill: `url(#${glow})` }),
    h('rect', { x: 0, y: 0, width: W, height: HEADER_H, fill: 'url(#hdr-grid)', mask: 'url(#hdr-mask)' }),
    h('path', { d: `M16 0.5H${W - 16}`, stroke: `url(#${edge})` }),
    core
      ? txt(core.left - 14, centerBaseline(DISC_CY, MONO_SMALL), COPY.core.toUpperCase(), {
          ...MONO_SMALL,
          fill: color.textTertiary,
          anchor: 'end',
        })
      : '',
    txt(PAD, 48, COPY.eyebrow.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary }),
    headline,
    txt(PAD, 110, COPY.subline, { size: 13, fill: color.textSecondary }),
    core ? core.markup : '',
  ]

  // ── table head ────────────────────────────────────────────────────────────
  const theadBase = centerBaseline(HEADER_H + THEAD_H / 2, MONO_SMALL)
  const thead = [
    txt(PAD, theadBase, COPY.colDomain.toUpperCase(), { ...MONO_SMALL, fill: color.textMuted }),
    txt(X0, theadBase, COPY.colItems.toUpperCase(), { ...MONO_SMALL, fill: color.textMuted }),
  ]


  // ── guides ────────────────────────────────────────────────────────────────
  const lines = [HEADER_H, HEADER_H + THEAD_H, ...blocks.slice(1).map((b) => b.top)]
  const guides = [
    h('path', { d: lines.map((ly) => `M0 ${ly + 0.5}H${W}`).join(''), stroke: color.border }),
    h('path', { d: `M${COL + 0.5} ${HEADER_H}V${H}`, stroke: color.border }),
    lines.map((ly) => crosshair(COL + 0.5, ly + 0.5, { stroke: color.textMuted })),
  ]

  // ── category rows ─────────────────────────────────────────────────────────
  const body = blocks.map(({ cat, index, rows, top }) => {
    const firstCy = top + CELL_PAD + CHIP_H / 2
    const labelBase = centerBaseline(firstCy, MONO_LABEL)
    const n = cat.items.length
    const meterY = labelBase + METER_DY
    const trackW = LABEL_R - 28 - LABEL_X
    const fillW = Math.max(4, Math.round((trackW * n) / maxCount))
    const left = [
      txt(PAD, labelBase, String(index + 1).padStart(2, '0'), { ...MONO_LABEL, tracking: 0, fill: color.textMuted }),
      txt(LABEL_X, labelBase, cat.title.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary }),
      h('rect', { x: LABEL_X, y: meterY - 1, width: trackW, height: 2, rx: 1, fill: color.surface3 }),
      h('rect', { x: LABEL_X, y: meterY - 1, width: fillW, height: 2, rx: 1, fill: `url(#${meter})` }),
      txt(LABEL_R, centerBaseline(meterY, { size: 12, family: 'mono' }), String(n), {
        size: 12,
        family: 'mono',
        fill: color.textSecondary,
        anchor: 'end',
        attrs: { style: 'font-variant-numeric:tabular-nums' },
      }),
    ]
    const chips = rows.flatMap((row, r) => {
      let x = X0
      const ry = top + CELL_PAD + r * (CHIP_H + ROW_GAP)
      return row.map((c) => {
        const markup = chip(doc, c, c.item, x, ry, coreSet.has(c.item))
        x += c.width + CHIP_GAP
        return markup
      })
    })
    return [left, chips]
  })

  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, header, guides),
    thead,
    body,
  )
}

export default {
  name: 'stack',
  render() {
    return [{ path: 'assets/stack.svg', svg: render() }]
  },
}
