// Expertise panel (stack.svg) — every content.stack domain as one table row.
//
//   ┌ ▣ Expertise · 117 technologies · 10 domains ───── CORE STACK ◉◉◉◉◉◉ ┐
//   ├ DOMAIN                       TOOLS ┼ TECHNOLOGIES ─────────────────────┤
//   │ AI & AGENTS                        │ [◆ Claude Code] [◆ OpenAI Codex] … │
//   │ [▮▮▮▮▮ EXPERT]                17   │ chips flow and wrap on measured    │
//   ├────────────────────────────────────┼ widths …                           │
//
// Motion (DESIGN.md rule 6): faint starfield behind the table (flare stars in the
// label column), a slow light band that cascades down the rows (one shineSweep per
// row, phased so it reads as a single wave), and each level meter's five segments
// shimmering in sequence as the band passes. AI domains carry the AI accent on
// their meter, level chip and chip borders, plus drifting AI particles.
// Repeated logos/glyphs are <symbol>s drawn with <use>.
//
// Static: copy comes from content.stack; `data` is accepted but not needed.

import { stack } from '../content.mjs'
import { glyph, hasGlyph } from '../core/glyphs.mjs'
import { hasIcon, iconInfo } from '../core/icons.mjs'
import { AI, constellation, particles, shineSweep, starfield } from '../core/motion.mjs'
import { crosshair, linearGradient, radialGradient } from '../core/primitives.mjs'
import { createDoc, h, panel, panelClip } from '../core/svg.mjs'
import { centerBaseline, measure, truncate, txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'
import { NUMERIC, panelHeader } from './shared/panel.mjs'

// ── copy that content.mjs does not carry ────────────────────────────────────
const COPY = {
  title: 'Expertise',
  colDomain: 'Domain',
  colCount: 'Tools',
  colItems: 'Technologies',
  core: 'Core stack',
}
// Core stack (content.stack item names): the toolbar's overlapping logo discs, and
// a brighter edge on their chips. Missing names are skipped.
const CORE = ['TypeScript', 'React 19', 'Next.js 15', 'NestJS 11', 'Expo 54', 'Prisma 7']
// Domains that carry the AI accent (DESIGN.md rule 5: AI visuals only).
const AI_DOMAIN = /\b(ai|agents?|rag|retrieval|automation)\b/i

// Brand marks are drawn from simple-icons' 24-unit paths. A wide mark squeezed into
// a 16px square reads tiny next to square logos, so every mark whose ink box is
// clearly wider than tall gets a tight viewBox (`box` = [x, y, w, h], measured
// from the path's bounding box + 0.25 margin) and is drawn at the same optical
// size: height = 16 · (h/w)^0.38, width capped at 28px (iconSize()).
// `clip` [x, y, w, h, rx?] crops inside the box; `stroke` thickens thin paths.
//   mysql:  the path is wordmark + dolphin; only the dolphin survives at chip size.
//   zapier: the path is an app tile with the wordmark knocked out; crop to the
//           wordmark band so it reads as a badge instead of a white square.
const ICON_FIT = {
  mysql: { box: [13.6, 3.2, 10.6, 10.6], clip: [13.6, 3.2, 10.6, 9.4], stroke: 0.6 },
  zapier: { box: [0.6, 7.4, 22.8, 9.2], clip: [0.6, 7.4, 22.8, 9.2, 2.4] },
  anthropic: { box: [-0.25, 3.29, 24.5, 17.42] },
  n8n: { box: [-0.25, 5.43, 24.5, 13.13] },
  make: { box: [-0.25, 3.25, 24.5, 17.5] },
  powershell: { box: [-0.25, 2.72, 24.5, 18.55] },
  handlebarsdotjs: { box: [-0.25, 4.7, 24.5, 14.61] },
  mdx: { box: [-0.25, 6.87, 24.5, 10.26] },
  markdown: { box: [-0.25, 4.36, 24.5, 15.27] },
  tailwindcss: { box: [-0.25, 4.55, 24.5, 14.9] },
  styledcomponents: { box: [-0.25, 6.51, 24.5, 10.98] },
  reactrouter: { box: [-0.25, 5.22, 24.5, 13.57] },
  express: { box: [-0.25, 2.98, 24.5, 18.04] },
  amazonaws: { box: [-0.25, 4.57, 24.5, 14.85] },
  cloudflare: { box: [-0.25, 6.32, 24.5, 11.35] },
  docker: { box: [-0.25, 3.14, 24.5, 17.72] },
  playwright: { box: [-0.25, 2.97, 24.5, 18.06] },
}
const ICON_MAX_W = 28

// ── geometry ────────────────────────────────────────────────────────────────
const W = layout.width
const PAD = layout.pad // 32
const COL = 224 // x of the column guide
const GUTTER = 24
const X0 = COL + GUTTER // chips start
const X1 = W - PAD // chips end
const LABEL_X = PAD // category label (no index: numbers belong to section headers)
const LABEL_R = COL - GUTTER // right edge of the label cell

const TOOLBAR = 64
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

// level chip: [▮▮▮▮▮  EXPERT]
const LVL_H = 22
const LVL_PAD = 8
const SEG_W = 4
const SEG_H = 10
const SEG_GAP = 2
const SEGS = 5
const SEG_TEXT_GAP = 8

// motion
const WAVE = 12 // s, one loop of the shine wave (band crosses a row in the first 45%)
const WAVE_ANGLE = 24 // ° skew of the band
const SHIMMER_STEP = 0.09 // s between meter segments

const NAME = { size: 13, weight: 500 }
const VERSION = { size: 12, weight: 400, family: 'mono' }
const MONO_LABEL = { size: 12, weight: 400, family: 'mono', tracking: 0.08 }
const MONO_SMALL = { size: 11, weight: 400, family: 'mono', tracking: 0.08 }
const COUNT = { size: 12, weight: 400, family: 'mono' }

const r2 = (v) => Math.round(v * 100) / 100

// "React 19" → { base: 'React', version: '19' }; "Tailwind CSS v4" → v4.
function splitVersion(name) {
  const m = /^(.*\S)\s+(v?\d[\w.]*)$/.exec(String(name ?? '').trim())
  return m ? { base: m[1], version: m[2] } : { base: String(name ?? '').trim(), version: '' }
}

// Drawn size of an item's icon → { w, h } (see ICON_FIT).
function iconSize(item) {
  const fit = hasIcon(item.icon) && ICON_FIT[item.icon]
  if (!fit) return { w: ICON, h: ICON }
  const ratio = fit.box[3] / fit.box[2]
  let hh = ICON * ratio ** 0.38
  let ww = hh / ratio
  if (ww > ICON_MAX_W) {
    ww = ICON_MAX_W
    hh = ww * ratio
  }
  return { w: r2(ww), h: r2(hh) }
}

function chipMetrics(item) {
  const { base: raw, version } = splitVersion(item.name)
  const iw = iconSize(item).w
  const versionW = version ? measure(version, VERSION) : 0
  // never wider than the chip area: truncate pathological names
  const room = X1 - X0 - (CHIP_PAD_L + iw + ICON_GAP + CHIP_PAD_R) - (version ? VERSION_GAP + versionW : 0)
  const base = truncate(raw, room, NAME)
  const baseW = measure(base, NAME)
  const width = Math.ceil(CHIP_PAD_L + iw + ICON_GAP + baseW + (version ? VERSION_GAP + versionW : 0) + CHIP_PAD_R)
  return { base, version, baseW, width, iw }
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

// ── icons as <symbol>s ──────────────────────────────────────────────────────
// Brand symbols leave `fill` to the <use>; glyph symbols carry their stroke.
function brandSymbol(doc, slug) {
  const id = `ic-${slug}`
  const info = iconInfo(slug)
  const fit = ICON_FIT[slug]
  if (fit) {
    const [bx, by, bw, bh] = fit.box
    let clip = null
    if (fit.clip) {
      const [cx, cy, cw, ch, rx] = fit.clip
      clip = doc.def(`crop-${slug}`, h('clipPath', { id: `crop-${slug}` }, h('rect', { x: cx, y: cy, width: cw, height: ch, rx: rx ?? null })))
    }
    return doc.def(
      id,
      h(
        'symbol',
        { id, viewBox: `${bx} ${by} ${bw} ${bh}` },
        h('path', {
          d: info.path,
          'stroke-width': fit.stroke || null,
          'stroke-linejoin': fit.stroke ? 'round' : null,
          'clip-path': clip ? `url(#${clip})` : null,
        }),
      ),
    )
  }
  return doc.def(id, h('symbol', { id, viewBox: '0 0 24 24' }, h('path', { d: info.path })))
}

function glyphSymbol(doc, name) {
  const id = `gl-${name}`
  // 24-unit symbol drawn at 16px: stroke 2.4 → 1.6px on screen
  return doc.def(id, h('symbol', { id, viewBox: '0 0 24 24' }, glyph(name, { x: 0, y: 0, size: 24, stroke: color.text, strokeWidth: 2.4 })))
}

// Item icon: brand logo → UI glyph → boxed monogram. (x, y) = top-left of the
// `size` square slot; fitted brand marks keep their own w × h, centred on the slot's line.
function itemIcon(doc, item, x, y, size, fill) {
  if (hasIcon(item.icon)) {
    const id = brandSymbol(doc, item.icon)
    const { w, h: hh } = iconSize(item)
    return h('use', { href: `#${id}`, x: r2(x), y: r2(y + (size - hh) / 2), width: w, height: hh, fill, stroke: ICON_FIT[item.icon]?.stroke ? fill : null })
  }
  if (item.glyph && hasGlyph(item.glyph)) {
    const id = glyphSymbol(doc, item.glyph)
    return h('use', { href: `#${id}`, x: r2(x), y: r2(y), width: size, height: size })
  }
  const letter = String(item.name ?? '?').trim().charAt(0).toUpperCase() || '?'
  const s = size * 0.62
  return [
    h('rect', { x: x + 0.75, y: y + 0.75, width: size - 1.5, height: size - 1.5, rx: 4, stroke: fill, 'stroke-width': 1.25, opacity: 0.9 }),
    txt(x + size / 2, centerBaseline(y + size / 2, { size: s, weight: 600 }), letter, { size: s, weight: 600, fill, anchor: 'middle' }),
  ].join('')
}

function chip(doc, m, item, x, y, { core = false, ai = false } = {}) {
  const cy = y + CHIP_H / 2
  const textX = x + CHIP_PAD_L + m.iw + ICON_GAP
  const base = centerBaseline(cy, NAME)
  const stroke = core ? 'url(#chip-stroke-core)' : ai ? 'url(#chip-stroke-ai)' : 'url(#chip-stroke)'
  return h(
    'g',
    {},
    h('rect', {
      x: x + 0.5,
      y: y + 0.5,
      width: m.width - 1,
      height: CHIP_H - 1,
      rx: CHIP_R,
      fill: core ? 'url(#chip-fill-core)' : 'url(#chip-fill)',
      stroke,
    }),
    itemIcon(doc, item, x + CHIP_PAD_L, cy - ICON / 2, ICON, color.text),
    txt(textX, base, m.base, { ...NAME, fill: color.text }),
    m.version ? txt(textX + m.baseW + VERSION_GAP, base, m.version, { ...VERSION, fill: color.textTertiary }) : '',
  )
}

// ── level chip: five lit segments + "EXPERT" ────────────────────────────────
function levelWidth(label) {
  return Math.ceil(LVL_PAD + SEGS * SEG_W + (SEGS - 1) * SEG_GAP + SEG_TEXT_GAP + measure(label, MONO_SMALL) + LVL_PAD)
}

// `start`: second at which the shine band reaches this row (the shimmer follows it).
function levelChip(doc, { x, cy, label, ai, start }) {
  const width = levelWidth(label)
  const top = cy - LVL_H / 2
  const segX0 = x + LVL_PAD
  const segY = cy - SEG_H / 2
  doc.css(`@keyframes stk-shim{0%{opacity:0}5%{opacity:.9}13%,100%{opacity:0}}
.stk-shim{animation:stk-shim ${WAVE}s cubic-bezier(.4,0,.2,1) infinite}`)
  const segs = []
  const flashes = []
  for (let i = 0; i < SEGS; i++) {
    const sx = segX0 + i * (SEG_W + SEG_GAP)
    segs.push(h('rect', { x: sx, y: segY, width: SEG_W, height: SEG_H, rx: 1 }))
    const t = start + 0.35 + i * SHIMMER_STEP
    flashes.push(
      h('rect', {
        x: sx - 0.5,
        y: segY - 0.5,
        width: SEG_W + 1,
        height: SEG_H + 1,
        rx: 1.5,
        fill: '#ffffff',
        opacity: 0,
        class: 'stk-shim',
        style: `animation-delay:${phase(t)}`,
      }),
    )
  }
  return h(
    'g',
    { class: 'stk-level' },
    h('rect', {
      x: x + 0.5,
      y: top + 0.5,
      width: width - 1,
      height: LVL_H - 1,
      rx: 6,
      fill: ai ? 'url(#lvl-fill-ai)' : color.surface,
      stroke: ai ? 'url(#lvl-stroke-ai)' : color.borderStrong,
    }),
    h('g', { fill: ai ? 'url(#lvl-seg-ai)' : color.text }, segs),
    flashes,
    txt(r2(segX0 + SEGS * SEG_W + (SEGS - 1) * SEG_GAP + SEG_TEXT_GAP), r2(centerBaseline(cy, MONO_SMALL)), label.toUpperCase(), {
      ...MONO_SMALL,
      fill: color.text,
    }),
  )
}

// Positive start time (s) → negative animation-delay inside the WAVE loop.
function phase(start) {
  const p = r2((((WAVE - start) % WAVE) + WAVE) % WAVE)
  return p ? `-${p}s` : '0s'
}

// ── toolbar core stack ──────────────────────────────────────────────────────
function coreItems(categories) {
  const items = categories.flatMap((c) => c.items)
  return CORE.map((name) => items.find((it) => it.name === name)).filter(Boolean)
}

// The toolbar's "Core stack": the CORE logos as overlapping discs (an avatar
// stack), labelled. No "+N" overflow pill: the subtitle already gives the total.
function coreStack(doc, categories, right, cy) {
  const slugs = coreItems(categories).map((it) => it.icon).filter((slug) => hasIcon(slug))
  const D = 28
  const STEP = 22
  if (!slugs.length) return null
  const n = slugs.length
  // discs overlap by D − STEP
  const left = right - ((n - 1) * STEP + D)
  const ring = linearGradient(doc, 'core-ring', [
    [0, color.borderHover],
    [1, color.border],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  const parts = []
  slugs.forEach((slug, i) => {
    const cx = left + i * STEP + D / 2
    const id = brandSymbol(doc, slug)
    parts.push(
      h('circle', { cx, cy, r: D / 2 + 1.5, fill: color.bg }),
      h('circle', { cx, cy, r: D / 2 - 0.5, fill: color.surface2, stroke: `url(#${ring})` }),
      h('use', { href: `#${id}`, x: cx - 7, y: cy - 7, width: 14, height: 14, fill: color.text }),
    )
  })
  return { markup: parts.join(''), left }
}

function render() {
  const categories = (Array.isArray(stack) ? stack : [])
    .map((c) => ({
      title: String(c?.title ?? ''),
      level: String(c?.level ?? '').trim(),
      items: (c?.items ?? []).filter((it) => it && it.name),
    }))
    .filter((c) => c.title && c.items.length)
  const unique = new Set(categories.flatMap((c) => c.items.map((it) => it.name))).size
  const coreSet = new Set(coreItems(categories))

  // Lay out every category first so the canvas height is exact.
  let y = TOOLBAR + THEAD_H
  const blocks = categories.map((cat) => {
    const ai = AI_DOMAIN.test(cat.title)
    const chips = cat.items.map((item) => ({ item, ...chipMetrics(item) }))
    const rows = flow(chips, X1 - X0)
    const chipsH = rows.length * CHIP_H + (rows.length - 1) * ROW_GAP
    // the label cell (label on chip row 1, level chip on chip row 2) sets a floor
    const labelCell = CHIP_H * 2 + ROW_GAP
    const height = Math.ceil(CELL_PAD * 2 + Math.max(chipsH, labelCell))
    const block = { cat, rows, top: y, height, ai }
    y += height
    return block
  })
  const H = y

  const desc = `Expertise: ${unique} technologies across ${categories.length} domains, every domain at ${
    [...new Set(categories.map((c) => c.level).filter(Boolean))].join(' / ') || 'working'
  } level. ${categories.map((c) => `${c.title}${c.level ? ` (${c.level})` : ''}: ${c.items.map((it) => it.name).join(', ')}.`).join(' ')}`
  const doc = createDoc({ width: W, height: H, title: 'RunyShark — expertise', desc })

  // ── shared paints ─────────────────────────────────────────────────────────
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
  // AI domains: border tinted blue → cyan → violet, kept faint
  linearGradient(doc, 'chip-stroke-ai', [
    [0, AI.blue, 0.42],
    [0.55, AI.cyan, 0.2],
    [1, AI.violet, 0.38],
  ], { x1: 0, y1: 0, x2: 1, y2: 1 })
  const segX0 = LABEL_X + LVL_PAD
  const segX1 = segX0 + SEGS * SEG_W + (SEGS - 1) * SEG_GAP
  linearGradient(doc, 'lvl-seg-ai', [
    [0, AI.blue],
    [0.5, AI.cyan],
    [1, AI.violet],
  ], { units: 'userSpaceOnUse', x1: segX0, y1: 0, x2: segX1, y2: 0 })
  linearGradient(doc, 'lvl-stroke-ai', [
    [0, AI.blue, 0.5],
    [1, AI.violet, 0.4],
  ], { x1: 0, y1: 0, x2: 1, y2: 0 })
  linearGradient(doc, 'lvl-fill-ai', [
    [0, AI.blue, 0.1],
    [1, AI.violet, 0.06],
  ], { x1: 0, y1: 0, x2: 1, y2: 0 })
  const aiWash = linearGradient(doc, 'ai-wash', [
    [0, AI.blue, 0.075],
    [0.6, AI.violet, 0.02],
    [1, AI.violet, 0],
  ], { units: 'userSpaceOnUse', x1: 0, y1: 0, x2: COL, y2: 0 })
  const glow = radialGradient(doc, 'stack-glow', [
    [0, color.amber, 0.12],
    [0.45, color.amber, 0.03],
    [1, color.amber, 0],
  ])
  const edge = linearGradient(doc, 'panel-edge', [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', 0.24],
    [1, '#ffffff', 0],
  ], { units: 'userSpaceOnUse', x1: 16, y1: 0, x2: W - 16, y2: 0 })
  const clip = panelClip(doc)

  // ── toolbar ───────────────────────────────────────────────────────────────
  const toolbar = panelHeader(doc, {
    icon: { glyph: 'layers' },
    title: COPY.title,
    subtitle: `${unique} technologies · ${categories.length} domains`,
    pills: [],
  })
  const core = coreStack(doc, categories, X1, TOOLBAR / 2)
  const coreLabel = core
    ? txt(core.left - 12, centerBaseline(TOOLBAR / 2, MONO_LABEL), COPY.core.toUpperCase(), { ...MONO_LABEL, fill: color.textTertiary, anchor: 'end' })
    : ''
  const focusX = core ? (core.left + X1) / 2 : W - 160

  // ── table head ────────────────────────────────────────────────────────────
  const theadBase = centerBaseline(TOOLBAR + THEAD_H / 2, MONO_SMALL)
  const thead = [
    txt(PAD, theadBase, COPY.colDomain.toUpperCase(), { ...MONO_SMALL, fill: color.textTertiary }),
    txt(LABEL_R, theadBase, COPY.colCount.toUpperCase(), { ...MONO_SMALL, fill: color.textTertiary, anchor: 'end' }),
    txt(X0, theadBase, COPY.colItems.toUpperCase(), { ...MONO_SMALL, fill: color.textTertiary }),
  ]

  // ── guides ────────────────────────────────────────────────────────────────
  const lines = [TOOLBAR + THEAD_H, ...blocks.slice(1).map((b) => b.top)]
  const guides = [
    h('path', { d: lines.map((ly) => `M0 ${ly + 0.5}H${W}`).join(''), stroke: color.border }),
    h('path', { d: `M${COL + 0.5} ${TOOLBAR}V${H}`, stroke: color.border }),
    [TOOLBAR, ...lines].map((ly) => crosshair(COL + 0.5, ly + 0.5, { stroke: color.borderHover })),
  ]

  // ── ambient: starfield, AI wash + particles ───────────────────────────────
  // text cells the stars keep clear of (label + level line of every row)
  const avoid = blocks.flatMap(({ top }) => [
    { x: PAD - 4, y: top + CELL_PAD + 4, w: LABEL_R - PAD + 8, h: CHIP_H * 2 + ROW_GAP - 8 },
  ])
  avoid.push({ x: PAD - 4, y: TOOLBAR + 8, w: W - PAD * 2 + 8, h: THEAD_H - 16 })
  const bodyTop = TOOLBAR
  const stars = [
    // behind the chips (opaque chips hide what falls under them)
    starfield(doc, { x: X0 - 12, y: bodyTop, w: W - X0 + 12, h: H - bodyTop, count: 150, seed: 'stack-body', twinkle: 0.55, opacity: 0.6, avoid }),
    // label column: sparser, with a few flare stars
    starfield(doc, { x: 4, y: bodyTop + THEAD_H, w: COL - 8, h: H - bodyTop - THEAD_H, count: 46, seed: 'stack-col', flares: 3, twinkle: 0.6, opacity: 0.55, avoid }),
  ]
  const aiBlocks = blocks.filter((b) => b.ai)
  const aiLayer = aiBlocks.length
    ? (() => {
        const top = Math.min(...aiBlocks.map((b) => b.top))
        const bottom = Math.max(...aiBlocks.map((b) => b.top + b.height))
        const accent = linearGradient(doc, 'ai-rail', [
          [0, AI.blue, 0],
          [0.2, AI.blue, 0.9],
          [0.55, AI.cyan, 0.8],
          [0.85, AI.violet, 0.8],
          [1, AI.violet, 0],
        ], { units: 'userSpaceOnUse', x1: 0, y1: top, x2: 0, y2: bottom })
        return [
          h('rect', { x: 0, y: top + 1, width: COL, height: bottom - top - 1, fill: `url(#${aiWash})` }),
          h('path', { d: `M1.5 ${top + 1}V${bottom}`, stroke: `url(#${accent})`, 'stroke-width': 1.5 }),
          // agent network in the free space under the level chip (tall AI rows only)
          aiBlocks.map((b, i) => {
            const y0 = b.top + CELL_PAD + CHIP_H * 2 + ROW_GAP + 12
            const hh = b.top + b.height - CELL_PAD + 4 - y0
            if (hh < 64) return ''
            return constellation(doc, {
              x: PAD + 8,
              y: y0,
              w: LABEL_R - PAD - 8,
              h: hh,
              nodes: Math.max(7, Math.min(12, Math.round(hh / 11))),
              seed: `stack-net-${i}`,
              k: 2,
              pulses: 4,
              color: '#cfe3ff',
              edgeOpacity: 0.18,
              nodeR: [1.2, 2.2],
              pulseDuration: 5,
            }).markup
          }),
          aiBlocks.map((b, i) =>
            particles(doc, {
              x: 8,
              y: b.top + 8,
              w: COL - 16,
              h: b.height - 16,
              count: 7,
              seed: `stack-ai-${i}`,
              direction: 'drift',
              colors: [AI.blue, AI.cyan, AI.violet],
              sizes: [0.8, 1.6],
              opacity: 0.8,
              avoid,
            }),
          ),
        ]
      })()
    : ''

  // ── signature: shine wave cascading down the rows ─────────────────────────
  // Row r starts when the band of row r−1 has moved one row-height's worth of skew,
  // plus a little extra so the cascade reads as moving down, not just across.
  const tan = Math.tan((WAVE_ANGLE * Math.PI) / 180)
  let t = 0
  const starts = blocks.map((b, i) => {
    if (i) {
      const prev = blocks[i - 1]
      const travel = W + 160 + prev.height * tan
      const v = travel / (WAVE * 0.45)
      t += (prev.height * tan) / v + 0.18
    }
    return r2(t)
  })
  const wave = blocks.map((b, i) =>
    shineSweep(doc, {
      x: 1,
      y: b.top + 1,
      w: W - 2,
      h: b.height - 1,
      r: 0,
      duration: WAVE,
      delay: phase(starts[i]),
      angle: WAVE_ANGLE,
      opacity: b.ai ? 0.1 : 0.07,
      band: 160,
    }),
  )

  // ── category rows ─────────────────────────────────────────────────────────
  const body = blocks.map(({ cat, rows, top, ai }, i) => {
    const firstCy = top + CELL_PAD + CHIP_H / 2
    const secondCy = firstCy + CHIP_H + ROW_GAP
    const labelBase = centerBaseline(firstCy, MONO_LABEL)
    const n = cat.items.length
    const titleRoom = LABEL_R - LABEL_X
    const left = [
      txt(LABEL_X, labelBase, truncate(cat.title.toUpperCase(), titleRoom, MONO_LABEL), { ...MONO_LABEL, fill: color.text }),
      cat.level ? levelChip(doc, { x: LABEL_X, cy: secondCy, label: cat.level, ai, start: starts[i] }) : '',
      txt(LABEL_R, centerBaseline(secondCy, COUNT), String(n), { ...COUNT, fill: color.textSecondary, anchor: 'end', attrs: NUMERIC }),
    ]
    const chips = rows.flatMap((row, r) => {
      let x = X0
      const ry = top + CELL_PAD + r * (CHIP_H + ROW_GAP)
      return row.map((c) => {
        const markup = chip(doc, c, c.item, x, ry, { core: coreSet.has(c.item), ai })
        x += c.width + CHIP_GAP
        return markup
      })
    })
    return [left, chips]
  })

  return doc.render(
    panel(doc),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      h('ellipse', { cx: focusX, cy: 0, rx: 300, ry: 120, fill: `url(#${glow})` }),
      h('path', { d: `M16 0.5H${W - 16}`, stroke: `url(#${edge})` }),
      aiLayer,
      stars,
      wave,
      guides,
    ),
    toolbar.markup,
    coreLabel,
    core ? core.markup : '',
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
