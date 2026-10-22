// Reusable visual building blocks. Every function returns SVG markup and
// registers any gradients/clips it needs on the doc passed in.

import { glyph } from './glyphs.mjs'
import { brandIcon, hasIcon, monogram } from './icons.mjs'
import { h } from './svg.mjs'
import { centerBaseline, measure, txt } from './text.mjs'
import { color } from './tokens.mjs'

export function linearGradient(doc, id, stops, { x1 = 0, y1 = 0, x2 = 1, y2 = 0, units } = {}) {
  return doc.def(
    id,
    h(
      'linearGradient',
      { id, x1, y1, x2, y2, gradientUnits: units },
      stops.map(([offset, stopColor, opacity = 1]) =>
        h('stop', { offset, 'stop-color': stopColor, 'stop-opacity': opacity === 1 ? null : opacity }),
      ),
    ),
  )
}

export function radialGradient(doc, id, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy, units, transform } = {}) {
  return doc.def(
    id,
    h(
      'radialGradient',
      { id, cx, cy, r, fx, fy, gradientUnits: units, gradientTransform: transform },
      stops.map(([offset, stopColor, opacity = 1]) =>
        h('stop', { offset, 'stop-color': stopColor, 'stop-opacity': opacity === 1 ? null : opacity }),
      ),
    ),
  )
}

// Vercel-style "+" marker drawn where grid guides intersect.
export function crosshair(x, y, { size = 11, stroke = color.borderHover, strokeWidth = 1 } = {}) {
  const s = size / 2
  return h(
    'path',
    { d: `M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}`, stroke, 'stroke-width': strokeWidth },
  )
}

// Thin guide lines (optionally dashed) — the grid scaffolding seen on vercel.com.
export function guide(x1, y1, x2, y2, { stroke = color.border, dash, opacity } = {}) {
  return h('path', {
    d: `M${x1} ${y1}L${x2} ${y2}`,
    stroke,
    'stroke-width': 1,
    'stroke-dasharray': dash,
    opacity,
  })
}

/**
 * Card surface. `glow` adds the soft top light from Aceternity/Vercel cards:
 *   glow: { color: '#f5a524', opacity: 0.22, height: 120 }
 * `highlight` draws the faint lit edge along the top border.
 */
export function card(doc, { x, y, w, h: height, r = 12, fill = color.surface, stroke = color.border, glow, highlight = true }) {
  const parts = [h('rect', { x: x + 0.5, y: y + 0.5, width: w - 1, height: height - 1, rx: r, fill, stroke })]
  if (glow) {
    const clipId = doc.def(
      `clip-card-${x}-${y}-${w}-${height}`,
      h('clipPath', { id: `clip-card-${x}-${y}-${w}-${height}` }, h('rect', { x, y, width: w, height, rx: r })),
    )
    const gid = radialGradient(
      doc,
      `glow-${glow.color.slice(1)}-${Math.round((glow.opacity ?? 0.2) * 100)}`,
      [
        [0, glow.color, glow.opacity ?? 0.2],
        [0.55, glow.color, (glow.opacity ?? 0.2) * 0.25],
        [1, glow.color, 0],
      ],
    )
    const gh = glow.height ?? Math.min(160, height * 0.6)
    parts.push(
      h(
        'g',
        { 'clip-path': `url(#${clipId})` },
        h('ellipse', { cx: x + w / 2, cy: y, rx: w * 0.62, ry: gh, fill: `url(#${gid})` }),
      ),
    )
  }
  if (highlight) {
    // userSpaceOnUse: a horizontal line has a zero-height bbox, which would void
    // an objectBoundingBox gradient and leave the stroke invisible.
    const hid = linearGradient(
      doc,
      `edge-highlight-${x}-${w}`,
      [
        [0, '#ffffff', 0],
        [0.5, '#ffffff', 0.22],
        [1, '#ffffff', 0],
      ],
      { units: 'userSpaceOnUse', x1: x + r, y1: 0, x2: x + w - r, y2: 0 },
    )
    parts.push(h('path', { d: `M${x + r} ${y + 0.5}H${x + w - r}`, stroke: `url(#${hid})`, 'stroke-width': 1 }))
  }
  return parts.join('')
}

/**
 * Square icon tile (rounded, bordered) holding a UI glyph, a brand logo or a monogram.
 *   iconTile(doc, { x, y, size: 36, glyph: 'rocket' })
 *   iconTile(doc, { x, y, size: 36, brand: 'nestjs' })
 */
export function iconTile(doc, { x, y, size = 36, r = 8, glyph: glyphName, brand, label, iconSize, iconColor = color.textSecondary, fill = color.surface2, stroke = color.borderStrong }) {
  const inner = iconSize ?? Math.round(size * 0.5)
  const off = (size - inner) / 2
  let icon
  if (glyphName) icon = glyph(glyphName, { x: x + off, y: y + off, size: inner, stroke: iconColor })
  else if (hasIcon(brand)) icon = brandIcon(brand, { x: x + off, y: y + off, size: inner, fill: iconColor })
  else icon = monogram(label ?? '?', { x: x + off, y: y + off, size: inner, fill: iconColor })
  return [h('rect', { x: x + 0.5, y: y + 0.5, width: size - 1, height: size - 1, rx: r, fill, stroke }), icon].join('')
}

// Status dot with an optional expanding pulse ring (CSS animation, reduced-motion safe).
export function statusDot(doc, cx, cy, { fill = color.greenBright, r = 4, pulse = true } = {}) {
  if (pulse) {
    doc.css(`@keyframes dot-pulse{0%{transform:scale(1);opacity:.55}80%,100%{transform:scale(3.2);opacity:0}}
.dot-pulse{transform-box:fill-box;transform-origin:center;animation:dot-pulse 2.4s cubic-bezier(0,0,.2,1) infinite}`)
  }
  return [
    pulse ? h('circle', { cx, cy, r, fill, class: 'dot-pulse' }) : '',
    h('circle', { cx, cy, r, fill }),
  ].join('')
}

/**
 * Rounded pill with optional leading dot and text; returns { markup, width }.
 * Used for status badges ("● Ready") and small tags.
 */
export function pill(doc, { x, y, text, height = 28, size = 13, weight = 500, family = 'sans', dot, fill = color.surface, stroke = color.borderStrong, textFill = color.text, padX = 12, pulse = true, align = 'start' }) {
  const textW = measure(text, { family, weight, size })
  const dotW = dot ? 16 : 0
  const width = padX * 2 + dotW + textW
  const left = align === 'middle' ? x - width / 2 : align === 'end' ? x - width : x
  const cy = y + height / 2
  return {
    width,
    markup: [
      h('rect', { x: left + 0.5, y: y + 0.5, width: width - 1, height: height - 1, rx: height / 2, fill, stroke }),
      dot ? statusDot(doc, left + padX + 4, cy, { fill: dot, r: 3.5, pulse }) : '',
      txt(left + padX + dotW, centerBaseline(cy, { family, weight, size }), text, { size, weight, family, fill: textFill }),
    ].join(''),
  }
}

// Smooth (monotone cubic) path through points [[x,y]...]; returns { line, area } path data.
export function smoothPath(points, baseline) {
  if (points.length < 2) return { line: '', area: '' }
  const n = points.length
  const dx = []
  const slope = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0])
    slope.push((points[i + 1][1] - points[i][1]) / dx[i])
  }
  const tangent = [slope[0]]
  for (let i = 1; i < n - 1; i++) tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  tangent.push(slope[n - 2])
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const c = dx[i] / 3
    d += `C${r2(x0 + c)} ${r2(y0 + tangent[i] * c)} ${r2(x1 - c)} ${r2(y1 - tangent[i + 1] * c)} ${r2(x1)} ${r2(y1)}`
  }
  const area = `${d}L${points[n - 1][0]} ${baseline}L${points[0][0]} ${baseline}Z`
  return { line: d, area }
}

function r2(v) {
  return Math.round(v * 100) / 100
}

// Mono uppercase eyebrow label ("01 / ABOUT").
export function eyebrow(x, y, text, { fill = color.textTertiary, size = 12, anchor } = {}) {
  return txt(x, y, text.toUpperCase(), { size, family: 'mono', weight: 400, tracking: 0.08, fill, anchor })
}
