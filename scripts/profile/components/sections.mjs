// Section headers: mono index + label, a tight Geist headline and a guide line
// with Vercel-style crosshairs. Transparent background so they sit directly on
// GitHub's page, between the black panels.
//
// Motion (DESIGN.md rule 6, v2): a soft-ended streak of light glides along the
// bottom rule and the "+" crosshair breathes. Phases are staggered by the
// section's index so stacked headers never pulse in sync. Text never moves; at
// rest the streak is hidden and the crosshair is at full strength. (A hard-ended
// dash was tried: entering/leaving the rule it showed as a stray 2px fragment.)

import { sections } from '../content.mjs'
import { crosshair, linearGradient } from '../core/primitives.mjs'
import { createDoc, h } from '../core/svg.mjs'
import { txt } from '../core/text.mjs'
import { color, layout } from '../core/tokens.mjs'
import { stagger } from '../core/motion.mjs'

const HEIGHT = 104
const PULSE = { duration: 7, period: 7 } // one trip along the rule per loop
const BREATHE = 4.8 // crosshair loop (s)
const RULE_START = 24 // clear of the crosshair
const RULE_END = 620 // the streak travels the visible part of the fading rule
const STREAK = 120

// One animated <g> (transform + opacity): fades in, glides, fades out over the
// first half of the loop, then waits hidden.
function streak(doc, { y, delay }) {
  const travel = RULE_END - RULE_START - STREAK
  const g = linearGradient(doc, 'rule-streak', [
    [0, '#ffffff', 0],
    [0.75, '#ffffff', 0.75],
    [1, '#ffffff', 0],
  ])
  doc.css(`@keyframes sec-streak{0%{transform:translateX(0);opacity:0}10%{opacity:1}40%{opacity:1}50%,100%{transform:translateX(${travel}px);opacity:0}}
.sec-streak{animation:sec-streak ${PULSE.duration}s cubic-bezier(.4,0,.6,1) infinite}`)
  return h(
    'g',
    { opacity: 0, class: 'sec-streak', style: delay && delay !== '0s' ? `animation-delay:${delay}` : null },
    h('rect', { x: RULE_START, y: y - 0.5, width: STREAK, height: 1, fill: `url(#${g})` }),
  )
}

function header(section, index, count) {
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
  doc.css(`@keyframes sec-breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.7);opacity:.45}}
.sec-breathe{transform-box:fill-box;transform-origin:center;animation:sec-breathe ${BREATHE}s ease-in-out infinite}`)
  const phase = stagger(index, count, PULSE.period)
  return doc.render(
    // index one step dimmer than the label, both within the readable range (≥ #878787)
    txt(0, 30, num, { size: 12, family: 'mono', fill: color.textTertiary }),
    txt(26, 30, section.label.toUpperCase(), { size: 12, family: 'mono', tracking: 0.08, fill: color.textSecondary }),
    txt(0, 70, section.title, { size: 28, weight: 600, tracking: -0.035, fill: color.text }),
    h('path', { d: `M0 ${lineY}H${layout.width}`, stroke: `url(#${fade})`, 'stroke-width': 1 }),
    streak(doc, { y: lineY, delay: phase }),
    h('g', { class: 'sec-breathe', style: `animation-delay:${stagger(index, count, BREATHE)}` }, crosshair(5.5, lineY, { stroke: color.textTertiary })),
  )
}

export default {
  name: 'sections',
  render() {
    return sections.map((section, i) => ({ path: `assets/sections/${section.id}.svg`, svg: header(section, i, sections.length) }))
  },
}
