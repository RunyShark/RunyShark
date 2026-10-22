#!/usr/bin/env node
// Screenshot one or more SVGs exactly as GitHub shows them: as <img> elements in
// an 846px column on the #0d1117 dark page.
//
//   node scripts/profile/tools/preview.mjs assets/hero.svg [more.svg…] --out preview.png
//     [--width 846] [--time 2500] [--scale 2] [--bg #0d1117]
//
// --time advances CSS/SMIL animations (virtual ms) before the capture.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chrome } from './chrome.mjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const out = path.resolve(opt('out', 'preview.png'))
const column = Number(opt('width', 846))
const time = Number(opt('time', 2500))
const scale = Number(opt('scale', 1))
const bg = opt('bg', '#0d1117')
const flagValues = new Set(['--out', '--width', '--time', '--scale', '--bg'].map((f) => opt(f.slice(2))))
const files = args.filter((a) => !a.startsWith('--') && !flagValues.has(a)).map((f) => path.resolve(f))
if (!files.length) {
  console.error('usage: preview.mjs <file.svg…> --out out.png')
  process.exit(1)
}

let total = 24
const imgs = files.map((file) => {
  const svg = fs.readFileSync(file, 'utf8')
  const w = Number(svg.match(/<svg[^>]*\swidth="([\d.]+)"/)?.[1] ?? column)
  const hgt = Number(svg.match(/<svg[^>]*\sheight="([\d.]+)"/)?.[1] ?? 200)
  const shown = Math.min(column, w)
  total += Math.ceil((hgt * shown) / w) + 16
  return `<img src="${pathToFileURL(file).href}" style="display:block;width:${shown}px;margin:0 auto 16px">`
})

const html = `<!doctype html><html><body style="margin:0;padding:12px 0;background:${bg}"><div style="width:${column}px;margin:0 auto">${imgs.join('')}</div></body></html>`
const tmp = path.join(os.tmpdir(), `profile-preview-${process.pid}.html`)
fs.writeFileSync(tmp, html)
chrome([
  `--window-size=${column + 40},${total}`,
  `--force-device-scale-factor=${scale}`,
  `--virtual-time-budget=${time}`,
  `--screenshot=${out}`,
  pathToFileURL(tmp).href,
])
fs.rmSync(tmp, { force: true })
console.log(`preview → ${out} (${column + 40}×${total} @${scale}x)`)
