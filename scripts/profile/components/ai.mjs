// AI systems: two SVGs for the "02 AI systems" section.
//
//   assets/ai.svg        Agent orchestration panel (Vercel "Agentic Infrastructure" +
//                        OpenAI "agents platform"): a glowing orchestrator core
//                        coordinating the six `ai.roles` hubs and 128 agent dots, packets
//                        travelling core → hub → agent and back, a KPI + two-tone
//                        statement, an orchestration terminal streaming `ai.log`, and
//                        the four `ai.pillars` as OpenAI-style gradient art cards.
//   assets/ai-cards.svg  Three OpenAI-style "model cards" (`ai.cards`) on deep-space
//                        starfields with nebulae, big title bottom-left, spec lines.
//
// Every number shown is a content claim (`profile.claims`, `ai.log`); nothing is
// invented. Motion follows DESIGN.md rule 6 (resting state complete, text static).

import { ai, profile } from '../content.mjs'
import { glyph } from '../core/glyphs.mjs'
import { AI, orbit, particles, pulseAlong, rng, shineSweep, stagger, starfield } from '../core/motion.mjs'
import { crosshair, guide, linearGradient, radialGradient, statusDot } from '../core/primitives.mjs'
import { createDoc, h, panel, panelClip } from '../core/svg.mjs'
import { capHeight, measure, txt, wrap } from '../core/text.mjs'
import { color } from '../core/tokens.mjs'
import { INK, NUMERIC, PANEL, TYPE, eyebrow, panelFooter, panelHeader } from './shared/panel.mjs'

const W = PANEL.width
const PAD = PANEL.pad
const GAP = PANEL.gap
const ACCENTS = [AI.blue, AI.cyan, AI.violet]
const GREEN = color.greenBright

const r2 = (v) => Math.round(v * 100) / 100
const rad = (deg) => (deg * Math.PI) / 180
const polar = (cx, cy, r, deg) => [r2(cx + r * Math.cos(rad(deg))), r2(cy + r * Math.sin(rad(deg)))]

// ════════════════════════════════════════════════════════════════════════════
// ai.svg
// ════════════════════════════════════════════════════════════════════════════

// Stage geometry (network on the left ~60%, copy + terminal on the right).
const TOP = PANEL.toolbar
const NET = { cx: 270, cy: 260, hub: 86, ring1: 134, ring2: 150, orbit: 170 }
const STAGE_H = 2 * (NET.cy - TOP) // network centred in the stage
const COL_X = 500 // right column
const COL_W = W - PAD - COL_X
const AGENTS = 128 // dots drawn on the outer rings; labels use profile.claims.parallelAgents ("100+")
const STAGE_BOTTOM = TOP + 2 * (NET.cy - TOP)
// text blocks in the stage corners, kept free of stars and particles
const NOTES = [
  { x: PAD + 8, y: TOP + 20, w: 120, h: 64 },
  { x: PAD + 8, y: STAGE_BOTTOM - 80, w: 110, h: 64 },
]

function aiPanel() {
  const roles = ai.roles?.length ? ai.roles : ['Planner', 'Architect', 'Builders', 'Reviewers', 'Verifiers', 'Release']
  const agentsClaim = profile.claims?.parallelAgents ?? '100+'

  // ── vertical rhythm ─────────────────────────────────────────────────────
  const stageBottom = TOP + STAGE_H
  const pillarsTop = stageBottom + PAD
  const pillar = pillarGeometry(ai.pillars ?? [])
  const footerY = pillarsTop + pillar.h + PAD
  const H = footerY + PANEL.footer

  const doc = createDoc({
    width: W,
    height: H,
    title: 'Agent orchestration — 100+ AI agents, one harness',
    desc:
      `Agent orchestration panel. A glowing orchestrator core coordinates six role hubs — ${roles.join(', ')} — ` +
      `and ${profile.claims?.parallelAgents ?? AGENTS} agents grouped by role on the outer rings, with data packets flowing from the orchestrator to each hub and agent and back. ` +
      `Beside it: ${agentsClaim} agents in parallel, "One harness, every role of a software team", and a harness log: ` +
      `${(ai.log ?? []).map((l) => l.trim().split(/\s{2,}/).join(' ')).join('; ')}. ` +
      `Below, four pillars: ${(ai.pillars ?? []).map((p) => `${p.title} — ${p.text}`).join(' ')}`,
  })
  const clip = panelClip(doc)

  // ── toolbar ─────────────────────────────────────────────────────────────
  const head = panelHeader(doc, {
    icon: { glyph: 'cpu' },
    title: 'Agent orchestration',
    subtitle: `${agentsClaim} agents · one harness`,
    pills: [
      { label: `${roles.length} roles`, glyph: 'users' },
      { label: 'Running', status: 'live', pulse: true },
    ],
  })

  // ── ambient: vignettes, starfield, particles ────────────────────────────
  const colRect = { x: COL_X - 12, y: TOP + 20, w: COL_W + 24, h: STAGE_H - 40 }
  const vignette = radialGradient(doc, 'ai-vignette', [
    [0, '#1a1f2e', 0.9],
    [0.5, '#0b0d14', 0.5],
    [1, '#000000', 0],
  ])
  const coolGlow = radialGradient(doc, 'ai-cool', [
    [0, AI.blue, 0.16],
    [0.5, AI.violet, 0.05],
    [1, AI.violet, 0],
  ])
  const ambient = [
    h('ellipse', { cx: NET.cx, cy: NET.cy, rx: 300, ry: 230, fill: `url(#${vignette})` }),
    h('ellipse', { cx: NET.cx + 30, cy: NET.cy + 40, rx: 260, ry: 200, fill: `url(#${coolGlow})` }),
    starfield(doc, { x: 0, y: TOP, w: W, h: STAGE_H, count: 150, seed: 'ai-stage', flares: 3, twinkle: 0.55, avoid: [colRect, ...NOTES, { x: NET.cx - 60, y: NET.cy - 60, w: 120, h: 120 }], opacity: 0.85 }),
    particles(doc, { x: 24, y: TOP + 8, w: COL_X - 48, h: STAGE_H - 16, count: 22, seed: 'ai-drift', colors: ACCENTS, sizes: [0.7, 1.5], opacity: 0.75, avoid: NOTES }),
  ]

  // ── grid guides ─────────────────────────────────────────────────────────
  const guides = [
    guide(PAD, TOP, PAD, stageBottom, { stroke: color.border, dash: '2 4' }),
    guide(W - PAD, TOP, W - PAD, stageBottom, { stroke: color.border, dash: '2 4' }),
    guide(0, stageBottom + 0.5, W, stageBottom + 0.5, { stroke: color.border }),
    crosshair(PAD, stageBottom + 0.5),
    crosshair(W - PAD, stageBottom + 0.5),
  ]

  const network = orchestration(doc, roles)
  const right = rightColumn(doc, agentsClaim)
  const pillars = pillarCards(doc, ai.pillars ?? [], pillarsTop, pillar)

  const foot = panelFooter(doc, {
    y: footerY,
    left: [['Harness', 'Claude Code · Codex · MCP']],
    right: [['Mode', 'parallel · verified']],
  })

  return doc.render(
    panel(doc),
    h('g', { 'clip-path': `url(#${clip})` }, ambient, guides, network, right, pillars),
    head.markup,
    foot.markup,
  )
}

// ── orchestration network ────────────────────────────────────────────────
function orchestration(doc, roles) {
  const { cx, cy } = NET
  const n = roles.length
  const span = 360 / n
  const hubs = roles.map((name, i) => {
    const deg = -90 + span * i
    const [x, y] = polar(cx, cy, NET.hub, deg)
    return { name, deg, x, y, color: ACCENTS[i % ACCENTS.length] }
  })

  // agents: split as evenly as possible across the role sectors, two staggered rings
  const agents = []
  const base = Math.floor(AGENTS / n)
  const extra = AGENTS - base * n
  hubs.forEach((hub, i) => {
    const count = base + (i < extra ? 1 : 0)
    const inner = Math.ceil(count / 2)
    const outer = count - inner
    const arc = span - 9 // gap between sectors
    for (let k = 0; k < inner; k++) {
      const deg = hub.deg - arc / 2 + (arc * (k + 0.5)) / inner
      agents.push({ hub: i, deg, ring: 0, ...xy(polar(cx, cy, NET.ring1, deg)) })
    }
    for (let k = 0; k < outer; k++) {
      const deg = hub.deg - arc / 2 + (arc * (k + 0.5)) / outer + (arc / outer) * 0.18
      agents.push({ hub: i, deg, ring: 1, ...xy(polar(cx, cy, NET.ring2, deg)) })
    }
  })
  const parts = []

  // rings: faint tracks + the slowly rotating outer orbit
  parts.push(
    h('circle', { cx, cy, r: NET.ring1, stroke: '#ffffff', 'stroke-opacity': 0.05 }),
    h('circle', { cx, cy, r: NET.ring2, stroke: '#ffffff', 'stroke-opacity': 0.035 }),
    orbit(doc, { cx, cy, r: NET.orbit, count: 4, duration: 120, seed: 'ai-orbit', dot: { r: 1.8, fill: ACCENTS }, ring: true }),
    orbit(doc, { cx, cy, r: 40, count: 3, duration: 18, seed: 'ai-core-orbit', dot: { r: 1.6, fill: [AI.cyan, AI.violet, AI.blue] }, ring: false, reverse: true }),
  )
  // sector arcs (role tint) just outside the outer ring
  hubs.forEach((hub) => {
    const a0 = hub.deg - (span - 9) / 2
    const a1 = hub.deg + (span - 9) / 2
    const [x0, y0] = polar(cx, cy, NET.ring2 + 10, a0)
    const [x1, y1] = polar(cx, cy, NET.ring2 + 10, a1)
    parts.push(h('path', { d: `M${x0} ${y0}A${NET.ring2 + 10} ${NET.ring2 + 10} 0 0 1 ${x1} ${y1}`, stroke: hub.color, 'stroke-opacity': 0.35, 'stroke-width': 1.5, 'stroke-linecap': 'round' }))
  })

  // spokes: core → hubs (dashed), hubs → their agents (hairlines)
  parts.push(
    h('path', { d: hubs.map((p) => `M${cx} ${cy}L${p.x} ${p.y}`).join(''), stroke: '#ffffff', 'stroke-opacity': 0.16, 'stroke-dasharray': '2 3' }),
    h('path', { d: agents.map((a) => `M${hubs[a.hub].x} ${hubs[a.hub].y}L${a.x} ${a.y}`).join(''), stroke: '#ffffff', 'stroke-opacity': 0.045 }),
  )

  // packets
  const pr = rng('ai-packets')
  const packets = []
  hubs.forEach((hub, i) => {
    // core → hub
    packets.push(pulseAlong(doc, { d: `M${cx} ${cy}L${hub.x} ${hub.y}`, color: hub.color, duration: 3.6, delay: r2(3.6 * (i / n)), length: 26, width: 1.6, rest: 0.35 }))
    const mine = agents.filter((a) => a.hub === i)
    // hub → agent (two per hub)
    for (let k = 0; k < 2; k++) {
      const a = mine[Math.floor(pr() * mine.length)]
      const dur = r2(pr.range(3.2, 4.6))
      packets.push(pulseAlong(doc, { d: `M${hub.x} ${hub.y}L${a.x} ${a.y}`, color: hub.color, duration: dur, delay: r2(pr() * dur), length: 34, width: 1.4, rest: 0.45 }))
    }
    // agent → hub → core (result coming back)
    const back = mine[Math.floor(pr() * mine.length)]
    const dur = r2(pr.range(4.6, 6))
    packets.push(pulseAlong(doc, { d: `M${back.x} ${back.y}L${hub.x} ${hub.y}L${cx} ${cy}`, color: '#ffffff', duration: dur, delay: r2(pr() * dur), length: 14, width: 1.2, rest: 0.4, opacity: 0.85 }))
  })
  parts.push(h('g', { class: 'ai-packets' }, packets))

  // agents: resting dots (always visible) + "done" flashes sweeping clockwise
  parts.push(
    h(
      'g',
      { fill: '#ededed' },
      agents.map((a) => h('circle', { cx: a.x, cy: a.y, r: a.ring ? 1.6 : 2, 'fill-opacity': a.ring ? 0.42 : 0.6 })),
    ),
  )
  const WAVE = 9
  const BUCKETS = 32
  doc.css(`@keyframes ai-done{0%,100%{opacity:0}5%{opacity:1}20%{opacity:0}}.ai-done{opacity:0;animation:ai-done ${WAVE}s ease-out infinite}`)
  const wr = rng('ai-wave')
  const buckets = Array.from({ length: BUCKETS }, () => [])
  agents.forEach((a) => {
    const t = (((a.deg + 90) % 360) + 360) % 360
    const b = (Math.floor((t / 360) * BUCKETS) + (wr.chance(0.25) ? 1 : 0)) % BUCKETS
    const c = hubs[a.hub].color
    buckets[b].push(
      h('circle', { cx: a.x, cy: a.y, r: 5, fill: c, 'fill-opacity': 0.22 }),
      h('circle', { cx: a.x, cy: a.y, r: a.ring ? 1.9 : 2.3, fill: c }),
    )
  })
  parts.push(
    h(
      'g',
      { class: 'ai-wave' },
      buckets.map((list, b) => (list.length ? h('g', { class: 'ai-done', style: `animation-delay:${stagger((BUCKETS - b) % BUCKETS, BUCKETS, WAVE)}` }, list) : '')),
    ),
  )

  // core: Vercel-style glowing triangle with a soft white/amber halo
  const halo = radialGradient(doc, 'ai-halo', [
    [0, '#ffffff', 0.55],
    [0.18, '#ffe7b8', 0.28],
    [0.45, color.amber, 0.09],
    [1, color.amber, 0],
  ])
  const tri = linearGradient(doc, 'ai-tri', [
    [0, '#ffffff'],
    [1, '#d9d9d9'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  doc.css(`@keyframes ai-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.86);opacity:.72}}.ai-breathe{transform-box:fill-box;transform-origin:center;animation:ai-breathe 6s ease-in-out infinite}`)
  const glow = radialGradient(doc, 'ai-tri-glow', [
    [0, '#ffffff', 0.85],
    [0.3, '#ffffff', 0.35],
    [1, '#ffffff', 0],
  ])
  const s = 17
  const triD = `M${cx} ${r2(cy - s)}L${r2(cx + s * 1.12)} ${r2(cy + s * 0.8)}H${r2(cx - s * 1.12)}Z`
  parts.push(
    h('circle', { cx, cy, r: 110, fill: `url(#${halo})`, class: 'ai-breathe' }),
    h('circle', { cx, cy: r2(cy + 2), r: 30, fill: `url(#${glow})` }),
    h('path', { d: triD, fill: `url(#${tri})` }),
  )

  // hubs: role pills with a tinted glow and status dot
  hubs.forEach((hub, i) => {
    const font = { size: 12, weight: 500 }
    const w = Math.ceil(measure(hub.name, font) + 34)
    const hh = 24
    const x = r2(hub.x - w / 2)
    const y = r2(hub.y - hh / 2)
    const g = radialGradient(doc, `ai-hub-glow-${i % ACCENTS.length}`, [
      [0, hub.color, 0.3],
      [1, hub.color, 0],
    ])
    parts.push(
      h('ellipse', { cx: hub.x, cy: hub.y, rx: w * 0.75, ry: 22, fill: `url(#${g})` }),
      h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: hh - 1, rx: (hh - 1) / 2, fill: '#0a0a0a', stroke: color.borderStrong }),
      h('circle', { cx: r2(x + 13), cy: hub.y, r: 3, fill: hub.color }),
      txt(r2(x + 22), r2(hub.y + capHeight(font) / 2), hub.name, { ...font, fill: INK.primary }),
    )
  })

  // corner annotations: eyebrow stack top-left, legend stack bottom-left (clear of the rings)
  const ax = PAD + 16
  parts.push(
    eyebrow(ax, TOP + 36, 'Orchestrator'),
    eyebrow(ax, TOP + 56, `${profile.claims?.parallelAgents ?? AGENTS} agents`, { fill: INK.secondary }),
    eyebrow(ax, TOP + 76, `${roles.length} roles`, { fill: INK.secondary }),
  )
  const legend = [
    ['Dispatch', AI.blue],
    ['Return', '#ffffff'],
    ['Done', AI.cyan],
  ]
  const ly0 = TOP + STAGE_H - 24 - (legend.length - 1) * 20
  legend.forEach(([label, c], k) => {
    const ly = ly0 + k * 20
    parts.push(h('circle', { cx: ax + 3, cy: ly - 4, r: 3, fill: c }), eyebrow(ax + 13, ly, label))
  })

  return h('g', { class: 'ai-network' }, parts)
}

function xy([x, y]) {
  return { x, y }
}

// ── right column: KPI, two-tone statement, terminal ──────────────────────
function rightColumn(doc, agentsClaim) {
  const x = COL_X
  const kpiFont = TYPE.kpi
  const stFont = { ...TYPE.statement, size: 20 }
  // two-tone statement (Vercel): bright lead, gray continuation on its own line(s)
  const lines = [
    ...wrap('One harness,', COL_W, stFont).map((t) => [{ w: t, c: INK.primary }]),
    ...wrap('every role of a software team.', COL_W, stFont).map((t) => [{ w: t, c: INK.tertiary }]),
  ]

  const log = (ai.log ?? []).map((l) => l.trim().split(/\s{2,}/))
  const term = terminalGeometry(log)

  // stack: eyebrow 12 · kpi · label · statement · terminal — centred in the stage
  const blockH = 28 + 32 + 36 + (lines.length - 1) * 26 + 26 + term.h
  let y = TOP + Math.max(24, Math.round((STAGE_H - blockH) / 2))
  const out = []
  out.push(eyebrow(x, y + 10, 'Parallel agents'))
  y += 14 + 14
  out.push(txt(x, r2(y + capHeight(kpiFont)), agentsClaim, { ...kpiFont, fill: INK.primary, attrs: NUMERIC }))
  // live chip next to the KPI
  const kw = measure(agentsClaim, kpiFont)
  out.push(liveChip(doc, x + kw + 14, r2(y + capHeight(kpiFont) / 2), 'in flight'))
  y += 32 + 36
  lines.forEach((ln, i) => {
    const content = ln
      .map((t) => `<tspan fill="${t.c}">${escape(t.w)}</tspan>`)
      .join('')
    out.push(txt(x, y + i * 26, '', { ...stFont, fill: INK.primary, content }))
  })
  y += (lines.length - 1) * 26 + 26
  out.push(terminal(doc, { x, y, w: COL_W, log, geo: term }))
  return h('g', { class: 'ai-copy' }, out)
}

function liveChip(doc, x, cy, label) {
  const font = { size: 12, weight: 500 }
  const w = Math.ceil(measure(label, font) + 30)
  const hh = 22
  return [
    h('rect', { x: r2(x + 0.5), y: r2(cy - hh / 2 + 0.5), width: w - 1, height: hh - 1, rx: (hh - 1) / 2, fill: GREEN, 'fill-opacity': 0.1, stroke: GREEN, 'stroke-opacity': 0.32 }),
    statusDot(doc, r2(x + 12), cy, { fill: GREEN, r: 3, pulse: true }),
    txt(r2(x + 21), r2(cy + capHeight(font) / 2), label, { ...font, fill: GREEN }),
  ].join('')
}

const MONO = { family: 'mono', size: 12, weight: 400 }
const LINE = 20

function terminalGeometry(log) {
  return { h: 36 + 14 + (log.length + 1) * LINE + 10 }
}

function terminal(doc, { x, y, w, log, geo }) {
  const hgt = geo.h
  const out = []
  const surf = linearGradient(doc, 'ai-term', [
    [0, '#0f0f10'],
    [1, '#070707'],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  out.push(
    h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: hgt - 1, rx: 12, fill: `url(#${surf})`, stroke: color.borderStrong }),
    h('path', { d: `M${x} ${y + 36.5}H${x + w}`, stroke: color.border }),
  )
  // chrome: three dots + file name + live indicator
  ;[0, 1, 2].forEach((i) => out.push(h('circle', { cx: x + 18 + i * 14, cy: y + 18, r: 4.5, fill: '#2a2a2a', stroke: '#3a3a3a' })))
  out.push(txt(x + 70, y + 22, 'harness.log', { ...MONO, fill: INK.tertiary }))
  out.push(txt(x + w - 16, y + 22, 'streaming', { ...MONO, fill: INK.tertiary, anchor: 'end' }))
  out.push(statusDot(doc, r2(x + w - 16 - measure('streaming', MONO) - 10), y + 18, { fill: AI.blue, r: 3, pulse: true }))

  // columns from measured widths
  const c1 = Math.max(...log.map((l) => measure(l[0] ?? '', MONO)))
  const c2 = Math.max(...log.map((l) => measure(l[1] ?? '', MONO)))
  const pad = 16
  const dotX = x + pad + 3
  const col1 = x + pad + 14
  const space = (w - pad * 2 - 14 - c1 - c2 - Math.max(...log.map((l) => measure(l[2] ?? '', MONO)))) / 2
  const gap = Math.max(10, Math.min(18, space))
  const col2 = col1 + c1 + gap
  const col3 = col2 + c2 + gap

  let ly = y + 36 + 14 + 13
  // command line
  out.push(
    txt(x + pad, ly, '', {
      ...MONO,
      content: `<tspan fill="${INK.tertiary}">$ </tspan><tspan fill="${INK.primary}">orchestrate --parallel --verify</tspan>`,
    }),
  )
  // sequential highlight (each line lights in turn) — the text itself never moves
  const SCAN = log.length * 1.6
  doc.css(`@keyframes ai-scan{0%,100%{opacity:0}3%,13%{opacity:1}20%{opacity:0}}.ai-scan{opacity:0;animation:ai-scan ${r2(SCAN)}s ease-in-out infinite}`)
  log.forEach((cols, i) => {
    ly += LINE
    const status = (cols[2] ?? '').toLowerCase()
    const running = status === 'running'
    const tone = running ? AI.blue : GREEN
    out.push(
      h('rect', {
        x: x + 6,
        y: r2(ly - 14.5),
        width: w - 12,
        height: 20,
        rx: 5,
        fill: '#ffffff',
        'fill-opacity': 0.055,
        class: 'ai-scan',
        style: `animation-delay:${stagger((log.length - i) % log.length, log.length, SCAN)}`,
      }),
      running ? statusDot(doc, dotX, r2(ly - 4), { fill: tone, r: 3, pulse: true }) : h('circle', { cx: dotX, cy: r2(ly - 4), r: 3, fill: tone }),
      txt(r2(col1), ly, cols[0] ?? '', { ...MONO, fill: INK.primary }),
      txt(r2(col2), ly, cols[1] ?? '', { ...MONO, fill: INK.secondary, attrs: NUMERIC }),
      txt(r2(col3), ly, cols[2] ?? '', { ...MONO, fill: running ? INK.primary : GREEN }),
    )
  })
  out.push(cometBeam(doc, { x, y, w, h: hgt, r: 12, color: AI.cyan, duration: 11, delay: 2, length: 16 }))
  return out.join('')
}

// ── pillars: OpenAI "Build / Contextualize / Act" gradient art cards ────────
const PILLAR_ART = 96
const PILLAR_PAD = 16
const PILLAR_TEXT = { size: 13, weight: 400 }
const PILLAR_LH = 19

function pillarGeometry(pillars) {
  const n = Math.max(1, pillars.length)
  const w = Math.floor((W - PAD * 2 - GAP * (n - 1)) / n)
  const lines = Math.max(1, ...pillars.map((p) => wrap(p.text, w - PILLAR_PAD * 2, PILLAR_TEXT).length))
  const h = PILLAR_ART + 20 + 15 + 12 + lines * PILLAR_LH + 12
  return { w, h, lines }
}

// [c0, c1, c2] gradient per pillar: blue → cyan → violet, rotated
const PILLAR_ART_COLORS = [
  [AI.blue, AI.violet, AI.cyan],
  [AI.cyan, AI.blue, AI.violet],
  [AI.violet, AI.cyan, AI.blue],
  [AI.blue, AI.cyan, AI.violet],
]

function pillarCards(doc, pillars, top, geo) {
  const out = []
  pillars.forEach((p, i) => {
    const x = PAD + i * (geo.w + GAP)
    const y = top
    const w = geo.w
    const [c0, c1, c2] = PILLAR_ART_COLORS[i % PILLAR_ART_COLORS.length]
    const clipId = doc.def(`ai-pillar-clip-${i}`, h('clipPath', { id: `ai-pillar-clip-${i}` }, h('rect', { x, y, width: w, height: geo.h, rx: 12 })))
    const lin = linearGradient(doc, `ai-pillar-lin-${i}`, [
      [0, c0],
      [0.55, c1],
      [1, c2],
    ], { x1: 0, y1: 0, x2: 1, y2: 0.6 })
    const blob = radialGradient(doc, 'ai-pillar-blob', [
      [0, '#ffffff', 0.7],
      [0.35, '#ffffff', 0.18],
      [1, '#ffffff', 0],
    ])
    const deep = radialGradient(doc, 'ai-pillar-deep', [
      [0, '#020617', 0.75],
      [1, '#020617', 0],
    ])
    const fade = linearGradient(doc, 'ai-pillar-fade', [
      [0, '#000000', 0],
      [0.6, '#000000', 0.08],
      [1, '#0a0a0a', 0.6],
    ], { x1: 0, y1: 0, x2: 0, y2: 1 })
    const pr = rng(`pillar:${i}`)
    const bx = x + w * pr.range(0.15, 0.85)
    const by = y + PILLAR_ART * pr.range(0.05, 0.4)
    const dx = x + w * pr.range(0.1, 0.9)
    const art = [
      h('rect', { x, y, width: w, height: PILLAR_ART, fill: `url(#${lin})`, 'fill-opacity': 0.78 }),
      h('ellipse', { cx: r2(dx), cy: r2(y + PILLAR_ART * 1.05), rx: w * 0.7, ry: PILLAR_ART * 0.6, fill: `url(#${deep})` }),
      h('ellipse', { cx: r2(bx), cy: r2(by), rx: w * 0.5, ry: PILLAR_ART * 0.55, fill: `url(#${blob})`, 'fill-opacity': 0.6 }),
      // fine contour lines (glass ripples) centred on the tile
      [30, 46, 64].map((r, k) => h('circle', { cx: x + w / 2, cy: y + PILLAR_ART / 2, r, stroke: '#ffffff', 'stroke-opacity': r2(0.22 - k * 0.06) })),
      particles(doc, { x: x + 8, y: y + 8, w: w - 16, h: PILLAR_ART - 12, count: 8, seed: `pillar-sparks-${i}`, direction: 'up', colors: ['#ffffff'], sizes: [0.8, 1.5], opacity: 0.95 }),
      h('rect', { x, y, width: w, height: PILLAR_ART, fill: `url(#${fade})` }),
      shineSweep(doc, { x, y, w, h: PILLAR_ART, r: 0, duration: 11, delay: r2(2.75 * i), opacity: 0.22 }),
    ]
    // frosted icon tile
    const T = 44
    const tx = r2(x + w / 2 - T / 2)
    const ty = r2(y + PILLAR_ART / 2 - T / 2)
    const tile = [
      h('rect', { x: tx, y: ty, width: T, height: T, rx: 12, fill: '#0a0f1f', 'fill-opacity': 0.35 }),
      h('rect', { x: tx + 0.5, y: ty + 0.5, width: T - 1, height: T - 1, rx: 11.5, fill: '#ffffff', 'fill-opacity': 0.16, stroke: '#ffffff', 'stroke-opacity': 0.42 }),
      h('path', { d: `M${tx + 12} ${ty + 0.75}H${tx + T - 12}`, stroke: '#ffffff', 'stroke-opacity': 0.7 }),
      glyph(p.glyph, { x: tx + 12, y: ty + 12, size: 20, stroke: '#ffffff', strokeWidth: 1.75 }),
    ]
    const ty0 = y + PILLAR_ART + 20 + capHeight(TYPE.title)
    const body = wrap(p.text, w - PILLAR_PAD * 2, PILLAR_TEXT)
    out.push(
      h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: geo.h - 1, rx: 12, fill: color.surface }),
      h('g', { 'clip-path': `url(#${clipId})` }, art),
      h('path', { d: `M${x} ${y + PILLAR_ART + 0.5}H${x + w}`, stroke: '#ffffff', 'stroke-opacity': 0.08 }),
      h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: geo.h - 1, rx: 12, stroke: color.border }),
      tile,
      txt(x + PILLAR_PAD, r2(ty0), p.title, { ...TYPE.title, fill: INK.primary }),
      body.map((ln, k) => txt(x + PILLAR_PAD, r2(ty0 + 12 + 10 + k * PILLAR_LH), ln, { ...PILLAR_TEXT, fill: INK.secondary })),
    )
  })
  return h('g', { class: 'ai-pillars' }, out)
}

// ════════════════════════════════════════════════════════════════════════════
// ai-cards.svg
// ════════════════════════════════════════════════════════════════════════════

const CARD_H = 330
const RELAY = 3 // cards taking turns with the comet beam
const CARD_PAD = 24
const SPEC = { size: 13, weight: 400 }
const SPEC_LH = 20
const NEBULA = [
  { a: AI.blue, b: '#1d4ed8', at: [0.78, 0.22], at2: [0.15, 0.7] },
  { a: AI.violet, b: '#6d28d9', at: [0.22, 0.25], at2: [0.85, 0.65] },
  { a: '#2dd4bf', b: AI.cyan, at: [0.7, 0.3], at2: [0.2, 0.62] },
]

function cardsSvg() {
  const cards = ai.cards ?? []
  const n = Math.max(1, cards.length)
  const cw = Math.floor((W - GAP * (n - 1)) / n)
  const doc = createDoc({
    width: W,
    height: CARD_H,
    title: 'AI systems — Agent Harness, RAG Engine, Automation Mesh',
    desc: `Three systems shown as model cards on deep-space starfields. ${cards
      .map((c) => `${c.title}: ${c.specs.map(([l, v]) => `${l} ${v}`).join('; ')}.`)
      .join(' ')}`,
  })

  // spec lines: "Label: value"; a value that does not fit wraps at " · " under itself
  const inner = cw - CARD_PAD * 2
  const laid = cards.map((c) => c.specs.map(([label, value]) => specLines(label, value, inner)))
  const maxRows = Math.max(...laid.map((specs) => specs.reduce((s, l) => s + l.rows.length, 0)))
  const titleBase = CARD_H - CARD_PAD - (maxRows - 1) * SPEC_LH - 12 - 18

  const out = cards.map((c, i) => modelCard(doc, { card: c, specs: laid[i], i, x: i * (cw + GAP), w: cw, titleBase }))
  return doc.render(out)
}

function specLines(label, value, maxW) {
  const lab = `${label}: `
  const lw = measure(lab, SPEC)
  if (lw + measure(value, SPEC) <= maxW) return { label: lab, lw, rows: [value] }
  const bits = value.split(' · ')
  const rows = []
  let cur = ''
  for (const b of bits) {
    const next = cur ? `${cur} · ${b}` : b
    if (cur && lw + measure(next, SPEC) > maxW) {
      rows.push(cur)
      cur = b
    } else cur = next
  }
  if (cur) rows.push(cur)
  return { label: lab, lw, rows }
}

function modelCard(doc, { card, specs, i, x, w, titleBase }) {
  const neb = NEBULA[i % NEBULA.length]
  const clipId = doc.def(`ai-card-clip-${i}`, h('clipPath', { id: `ai-card-clip-${i}` }, h('rect', { x, y: 0, width: w, height: CARD_H, rx: 16 })))
  const g1 = radialGradient(doc, `ai-neb-a-${i}`, [
    [0, neb.a, 0.34],
    [0.45, neb.b, 0.12],
    [1, neb.b, 0],
  ])
  const g2 = radialGradient(doc, `ai-neb-b-${i}`, [
    [0, neb.b, 0.22],
    [1, neb.b, 0],
  ])
  const shade = linearGradient(doc, 'ai-card-shade', [
    [0, '#000000', 0],
    [0.5, '#000000', 0.1],
    [1, '#000000', 0.82],
  ], { x1: 0, y1: 0, x2: 0, y2: 1 })
  const textTop = titleBase - 30
  const art = [
    h('rect', { x, y: 0, width: w, height: CARD_H, fill: '#020306' }),
    h('ellipse', { cx: r2(x + w * neb.at[0]), cy: r2(CARD_H * neb.at[1]), rx: w * 0.75, ry: CARD_H * 0.55, fill: `url(#${g1})`, transform: `rotate(${-24 + i * 20} ${r2(x + w * neb.at[0])} ${r2(CARD_H * neb.at[1])})` }),
    h('ellipse', { cx: r2(x + w * neb.at2[0]), cy: r2(CARD_H * neb.at2[1]), rx: w * 0.55, ry: CARD_H * 0.35, fill: `url(#${g2})` }),
    starfield(doc, { x, y: 0, w, h: CARD_H, count: 130, seed: `card-${i}`, flares: 2, twinkle: 0.6, avoid: [{ x: x + 16, y: textTop + 8, w: w - 32, h: CARD_H - textTop - 16 }] }),
    cardMotif(doc, i, { x, w, top: 24, bottom: textTop - 12, color: neb.a }),
    h('rect', { x, y: 0, width: w, height: CARD_H, fill: `url(#${shade})` }),
    shineSweep(doc, { x, y: 0, w, h: CARD_H, r: 16, duration: 12, delay: r2(4 * i), opacity: 0.05 }),
  ]

  const tx = x + CARD_PAD
  const text = [txt(tx, titleBase, card.title, { size: 24, weight: 600, tracking: -0.03, fill: INK.primary })]
  let y = titleBase + 30
  specs.forEach((s) => {
    s.rows.forEach((row, k) => {
      text.push(
        k === 0
          ? txt(tx, y, '', { ...SPEC, content: `<tspan fill="${INK.secondary}">${escape(s.label)}</tspan><tspan fill="${INK.primary}">${escape(row)}</tspan>` })
          : txt(r2(tx + s.lw), y, row, { ...SPEC, fill: INK.primary }),
      )
      y += SPEC_LH
    })
  })

  return h(
    'g',
    { class: 'ai-card' },
    h('g', { 'clip-path': `url(#${clipId})` }, art),
    h('rect', { x: x + 0.5, y: 0.5, width: w - 1, height: CARD_H - 1, rx: 16, stroke: color.border }),
    h('path', { d: `M${x + 24} 0.5H${x + w - 24}`, stroke: `url(#${edge(doc, x, w)})` }),
    // relay: one lap per card in turn, left to right (only one beam in flight at a time)
    cometBeam(doc, { x, y: 0, w, h: CARD_H, r: 16, color: neb.a, duration: 7 * RELAY, delay: r2(7 * (RELAY - i)), active: 1 / RELAY, length: 9, opacity: 0.9 }),
    text,
  )
}

function edge(doc, x, w) {
  return linearGradient(doc, `ai-card-edge-${x}`, [
    [0, '#ffffff', 0],
    [0.5, '#ffffff', 0.28],
    [1, '#ffffff', 0],
  ], { units: 'userSpaceOnUse', x1: x + 24, y1: 0, x2: x + w - 24, y2: 0 })
}

// Comet beam round a rounded rect (signature motion) without filters: four dashes on one
// closed path (pathLength 100) — a faint wide glow, a dim tail, a brighter body and a
// white head — on one linear stroke-dashoffset loop, so the comet never jumps.
// active < 1: the lap takes that share of the loop, then the comet fades out and waits
// (cards take turns). Rest state: the comet sits on the top edge.
function cometBeam(doc, { x, y, w, h: hh, r = 12, color: c = AI.cyan, duration = 12, delay = 0, length = 14, opacity = 1, active = 1 }) {
  const share = Math.round(Math.max(0.1, Math.min(1, active)) * 100)
  const name = share === 100 ? 'ai-comet' : `ai-comet-${share}`
  doc.css(
    share === 100
      ? '@keyframes ai-comet{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}.ai-comet{animation:ai-comet 12s linear infinite}'
      : `@keyframes ${name}{0%{stroke-dashoffset:0;opacity:0}4%{opacity:1}${share - 6}%{opacity:1}${share}%,100%{stroke-dashoffset:-100;opacity:0}}.${name}{animation:${name} 12s linear infinite}`,
  )
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
    { class: 'ai-beam' },
    layers.map(([f, col, sw, op]) =>
      h('path', {
        d,
        pathLength: 100,
        stroke: col,
        'stroke-width': sw,
        'stroke-opacity': r2(op * opacity),
        'stroke-dasharray': `0 ${r2(L * f)} ${r2(L * (1 - f))} ${r2(100 - L)}`,
        'stroke-dashoffset': -6,
        class: name,
        style,
      }),
    ),
  )
}

function roundedRect(x, y, w, hh, r) {
  const R = Math.max(0, Math.min(r, w / 2, hh / 2))
  return `M${r2(x + R)} ${r2(y)}H${r2(x + w - R)}A${R} ${R} 0 0 1 ${r2(x + w)} ${r2(y + R)}V${r2(y + hh - R)}A${R} ${R} 0 0 1 ${r2(x + w - R)} ${r2(y + hh)}H${r2(x + R)}A${R} ${R} 0 0 1 ${r2(x)} ${r2(y + hh - R)}V${r2(y + R)}A${R} ${R} 0 0 1 ${r2(x + R)} ${r2(y)}Z`
}

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// A quiet AI motif per card, in the upper sky (above the title block).
function cardMotif(doc, i, { x, w, top, bottom, color: c }) {
  const hgt = bottom - top
  const r = rng(`motif:${i}`)
  if (i % 3 === 0) {
    // Agent Harness: a hub star with agents around it, packets out and back
    const cx = x + w * 0.62
    const cy = top + hgt * 0.48
    const pts = Array.from({ length: 9 }, (_, k) => {
      const a = -90 + (360 / 9) * k + r.range(-10, 10)
      const rr = r.range(38, 70)
      return polar(cx, cy, rr, a)
    })
    return h(
      'g',
      { class: 'ai-motif' },
      h('path', { d: pts.map(([px, py]) => `M${r2(cx)} ${r2(cy)}L${px} ${py}`).join(''), stroke: '#ffffff', 'stroke-opacity': 0.12 }),
      h('circle', { cx: r2(cx), cy: r2(cy), r: 46, stroke: '#ffffff', 'stroke-opacity': 0.06, 'stroke-dasharray': '2 4' }),
      pts.slice(0, 4).map(([px, py], k) => pulseAlong(doc, { d: `M${r2(cx)} ${r2(cy)}L${px} ${py}`, color: k % 2 ? AI.cyan : c, duration: 3.8, delay: r2(k * 0.95), length: 30, width: 1.3, rest: 0.4 })),
      h('g', { fill: '#ffffff' }, pts.map(([px, py]) => [h('circle', { cx: px, cy: py, r: 4, 'fill-opacity': 0.1 }), h('circle', { cx: px, cy: py, r: 1.6, 'fill-opacity': 0.9 })])),
      h('use', { href: '#mk-flare', transform: `translate(${r2(cx)} ${r2(cy)}) scale(1.5)` }),
    )
  }
  if (i % 3 === 1) {
    // RAG Engine: embedding clusters + a query point linked to its nearest neighbours
    const centers = [
      [x + w * 0.3, top + hgt * 0.35],
      [x + w * 0.72, top + hgt * 0.3],
      [x + w * 0.55, top + hgt * 0.75],
    ]
    const dots = []
    centers.forEach(([ccx, ccy], k) => {
      for (let j = 0; j < 18; j++) {
        const a = r.range(0, 360)
        const d = Math.abs(r() + r() - 1) * 34
        const [px, py] = polar(ccx, ccy, d, a)
        dots.push({ x: px, y: py, k })
      }
    })
    const q = { x: r2(x + w * 0.62), y: r2(top + hgt * 0.5) }
    const near = [...dots].sort((a, b) => (a.x - q.x) ** 2 + (a.y - q.y) ** 2 - ((b.x - q.x) ** 2 + (b.y - q.y) ** 2)).slice(0, 5)
    const tints = [AI.violet, AI.blue, AI.cyan]
    const halos = tints.map((t, k) => radialGradient(doc, `ai-rag-halo-${k}`, [
      [0, t, 0.3],
      [1, t, 0],
    ]))
    return h(
      'g',
      { class: 'ai-motif' },
      centers.map(([ccx, ccy], k) => h('circle', { cx: r2(ccx), cy: r2(ccy), r: 40, fill: `url(#${halos[k]})` })),
      h('path', { d: near.map((p) => `M${q.x} ${q.y}L${p.x} ${p.y}`).join(''), stroke: '#ffffff', 'stroke-opacity': 0.2, 'stroke-dasharray': '2 3' }),
      near.slice(0, 3).map((p, k) => pulseAlong(doc, { d: `M${p.x} ${p.y}L${q.x} ${q.y}`, color: tints[k], duration: 4, delay: r2(k * 1.3), length: 40, width: 1.3, rest: 0.45 })),
      dots.map((p) => h('circle', { cx: p.x, cy: p.y, r: 1.9, fill: tints[p.k], 'fill-opacity': 0.85 })),
      near.map((p) => h('circle', { cx: p.x, cy: p.y, r: 3.2, stroke: '#ffffff', 'stroke-opacity': 0.55 })),
      h('use', { href: '#mk-flare', transform: `translate(${q.x} ${q.y}) scale(1.3)` }),
    )
  }
  // Automation Mesh: concentric loops with nodes orbiting a trigger star
  const cx = x + w * 0.58
  const cy = top + hgt * 0.5
  return h(
    'g',
    { class: 'ai-motif' },
    [30, 52, 74].map((rr, k) => h('circle', { cx: r2(cx), cy: r2(cy), r: rr, stroke: k === 1 ? c : '#ffffff', 'stroke-opacity': k === 1 ? 0.28 : 0.13, 'stroke-dasharray': k === 2 ? '2 4' : null })),
    orbit(doc, { cx: r2(cx), cy: r2(cy), r: 30, count: 2, duration: 16, seed: `m-${i}-a`, dot: { r: 2.2, fill: [AI.cyan, '#ffffff'] }, ring: false }),
    orbit(doc, { cx: r2(cx), cy: r2(cy), r: 52, count: 3, duration: 28, seed: `m-${i}-b`, dot: { r: 2, fill: [c, AI.blue, '#ffffff'] }, ring: false, reverse: true }),
    orbit(doc, { cx: r2(cx), cy: r2(cy), r: 74, count: 4, duration: 44, seed: `m-${i}-c`, dot: { r: 1.8, fill: ['#ffffff', AI.cyan] }, ring: false }),
    h('use', { href: '#mk-flare', transform: `translate(${r2(cx)} ${r2(cy)}) scale(1.4)` }),
  )
}

// ════════════════════════════════════════════════════════════════════════════

export default {
  name: 'ai',
  render() {
    return [
      { path: 'assets/ai.svg', svg: aiPanel() },
      { path: 'assets/ai-cards.svg', svg: cardsSvg() },
    ]
  },
}


