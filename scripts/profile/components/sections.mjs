// Section headers: mono index + label, a tight Geist headline and a guide line
// with Vercel-style crosshairs. Transparent background so they sit directly on
// GitHub's page, between the black panels.

import { sections } from '../content.mjs'
import { crosshair, linearGradient } from '../core/primitives.mjs'
import { createDoc, h } from '../core/svg.mjs'
import { txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'

const HEIGHT = 104

function header(section, index) {
  const doc = createDoc({
    width: layout.width,
    height: HEIGHT,
    title: `${section.label} — ${section.title}`,
  })
  const num = String(index + 1).padStart(2, '0')
  const lineY = HEIGHT - 12
  const fade = linearGradient(
    doc,
    'rule-fade',
    [
      [0, color.borderHover],
      [0.6, color.borderStrong],
      [1, color.borderStrong, 0],
    ],
    { units: 'userSpaceOnUse', x1: 0, y1: 0, x2: layout.width, y2: 0 },
  )
  return doc.render(
    txt(0, 30, num, { size: 12, family: 'mono', fill: color.textMuted }),
    txt(26, 30, section.label.toUpperCase(), { size: 12, family: 'mono', tracking: 0.08, fill: color.textTertiary }),
    txt(0, 70, section.title, { size: 28, weight: 600, tracking: -0.035, fill: color.text }),
    h('path', { d: `M0 ${lineY}H${layout.width}`, stroke: `url(#${fade})`, 'stroke-width': 1 }),
    crosshair(5.5, lineY, { stroke: color.textMuted }),
  )
}

export default {
  name: 'sections',
  render() {
    return sections.map((section, i) => ({ path: `assets/sections/${section.id}.svg`, svg: header(section, i) }))
  },
}
