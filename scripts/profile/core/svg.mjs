// Minimal SVG authoring kit: escaping, an element builder and a document that
// collects <defs>/CSS while components draw, then embeds only the fonts used.

import { fontFaceCss, fontRuleCss } from './fonts.mjs'
import { color } from './tokens.mjs'

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(value) {
  return typeof value === 'number' ? String(Math.round(value * 100) / 100) : esc(value)
}

// Attribute names are written verbatim (SVG mixes camelCase and kebab-case).
export function attrs(obj = {}) {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${fmt(v)}"`))
    .join('')
}

// h('rect', { x: 0 }) → '<rect x="0"/>'; children may be strings, arrays or falsy.
export function h(tag, props, ...children) {
  const body = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== '')
  return body.length ? `<${tag}${attrs(props)}>${body.join('')}</${tag}>` : `<${tag}${attrs(props)}/>`
}

const BASE_CSS = `
text{font-kerning:normal;text-rendering:geometricPrecision}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
`

export function createDoc({ width, height, title, desc = '' }) {
  const defs = new Map()
  const css = new Set()
  let counter = 0
  return {
    width,
    height,
    uid(prefix = 'id') {
      counter += 1
      return `${prefix}${counter}`
    },
    // Registers a <defs> entry once (keyed by id) and returns the id.
    def(id, markup) {
      if (!defs.has(id)) defs.set(id, markup)
      return id
    },
    css(rule) {
      css.add(rule.trim())
    },
    render(...body) {
      const content = body.flat(Infinity).filter(Boolean).join('')
      const fontKeys = [...new Set(content.match(/f-(?:sans|mono)-\d{3}/g) ?? [])].map((c) => c.slice(2))
      const style = [fontFaceCss(fontKeys), fontRuleCss(fontKeys), BASE_CSS, ...css].join('\n')
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-labelledby="title desc">`,
        h('title', { id: 'title' }, esc(title)),
        h('desc', { id: 'desc' }, esc(desc || title)),
        `<style>${style}</style>`,
        defs.size ? `<defs>${[...defs.values()].join('')}</defs>` : '',
        content,
        '</svg>',
      ].join('')
    },
  }
}

// Rounded black panel every standalone SVG sits on, so it reads as a card on
// GitHub's #0d1117 page background.
export function panel(doc, { r = 16, fill = color.bg, stroke = color.border } = {}) {
  return h('rect', {
    x: 0.5,
    y: 0.5,
    width: doc.width - 1,
    height: doc.height - 1,
    rx: r,
    fill,
    stroke,
  })
}

// Clip path matching panel(), for layers that must not bleed past the corners.
export function panelClip(doc, r = 16) {
  return doc.def(
    'panel-clip',
    h('clipPath', { id: 'panel-clip' }, h('rect', { x: 0, y: 0, width: doc.width, height: doc.height, rx: r })),
  )
}
