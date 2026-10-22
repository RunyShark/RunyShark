// Brand logos from simple-icons (vendor/icons.json, 24×24 single-path glyphs).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { h } from './svg.mjs'
import { txt } from './text.mjs'
import { color } from './tokens.mjs'

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor')
const icons = JSON.parse(fs.readFileSync(path.join(vendor, 'icons.json'), 'utf8'))

export function hasIcon(slug) {
  return Boolean(slug && icons[slug])
}

export function iconInfo(slug) {
  return icons[slug] ?? null
}

// Logo with its top-left corner at (x, y). Monochrome by default — the Vercel look.
export function brandIcon(slug, { x = 0, y = 0, size = 16, fill = color.text, opacity } = {}) {
  const icon = icons[slug]
  if (!icon) return null
  const s = Math.round((size / 24) * 1000) / 1000
  return h('path', { d: icon.path, fill, opacity, transform: `translate(${x} ${y}) scale(${s})` })
}

// Fallback for items without a logo: the first letter, centred in the icon box.
export function monogram(label, { x = 0, y = 0, size = 16, fill = color.text } = {}) {
  const letter = String(label).trim().charAt(0).toUpperCase()
  return txt(x + size / 2, y + size * 0.82, letter, {
    size: size * 1.05,
    weight: 700,
    anchor: 'middle',
    fill,
  })
}
