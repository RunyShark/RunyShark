// Embedded Geist subsets (vendor/fonts.json). Text elements carry a class like
// `f-sans-600`; createDoc() embeds exactly the faces those classes reference.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontStack } from './tokens.mjs'

const vendor = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor')
const fonts = JSON.parse(fs.readFileSync(path.join(vendor, 'fonts.json'), 'utf8'))

const FAMILY = { sans: 'Geist', mono: 'Geist Mono' }

export const available = Object.keys(fonts)

// Closest vendored weight for a family (e.g. mono-600 → mono-500).
export function resolveFont(family = 'sans', weight = 400) {
  const weights = available
    .filter((k) => k.startsWith(`${family}-`))
    .map((k) => Number(k.split('-')[1]))
  const best = weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a))
  return `${family}-${best}`
}

export function fontFaceCss(keys) {
  return keys
    .map((key) => {
      const [family, weight] = key.split('-')
      return `@font-face{font-family:'${FAMILY[family]}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${fonts[key]}) format('woff2')}`
    })
    .join('')
}

export function fontRuleCss(keys) {
  return keys
    .map((key) => {
      const [family, weight] = key.split('-')
      return `.f-${key}{font-family:${fontStack[family]};font-weight:${weight}}`
    })
    .join('')
}
