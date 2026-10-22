#!/usr/bin/env node
// Screenshot one or more SVGs exactly as GitHub shows them: as <img> elements in
// an 846px column on the #0d1117 dark page.
//
//   node scripts/profile/tools/preview.mjs assets/hero.svg [more.svg…] --out preview.png
//     [--width 846] [--time 2500] [--scale 2] [--bg #0d1117] [--inline]
//
//   --out     PNG to write (default ./preview.png)
//   --width   column width in CSS px (default 846, GitHub's README column)
//   --scale   device scale factor (default 1; use 2 for review)
//   --bg      page background (default #0d1117, GitHub dark)
//   --time    default mode: Chrome's --virtual-time-budget in ms (default 2500), i.e.
//             how long the page may load before the capture. Headless Chrome does NOT
//             advance CSS/SMIL animations inside <img> under virtual time, so this
//             always shows (roughly) the first frame.
//             --inline mode: the animation time in ms to freeze every SVG at.
//   --inline  opt-in frame mode. Each SVG is inlined into its own srcdoc <iframe>
//             (one document per SVG, so ids like #panel-clip, @keyframes and
//             @font-face never collide between files), sized exactly like the <img>.
//             Inside each document SMIL is frozen with svg.pauseAnimations() +
//             svg.setCurrentTime(time / 1000) and CSS animations with
//             document.getAnimations() → pause() + currentTime = time. Use it to
//             inspect any moment of an animation (typing, sweeps, drift…). The page
//             gets a fixed 3000 ms virtual-time budget to load fonts before capture.
//             Note: this is the SVG as an inline document, not GitHub's <img>
//             sandbox, so use the default mode to judge what actually ships.

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
const inline = args.includes('--inline')
const INLINE_BUDGET = 3000 // virtual ms for --inline pages to load fonts before capture
const flagValues = new Set(['--out', '--width', '--time', '--scale', '--bg'].map((f) => opt(f.slice(2))))
const files = args.filter((a) => !a.startsWith('--') && !flagValues.has(a)).map((f) => path.resolve(f))
if (!files.length) {
  console.error('usage: preview.mjs <file.svg…> --out out.png [--inline --time <ms>]')
  process.exit(1)
}

// Runs inside each inlined SVG document: freeze every outermost <svg> time
// container (SMIL) and every CSS/Web animation at `ms`. Re-applied on load so
// animations created after parsing (late style/font resolution) are frozen too.
const freezeScript = (ms) => `<script>(() => {
  const freeze = () => {
    for (const s of document.querySelectorAll('svg')) {
      if (s.parentElement && s.parentElement.closest('svg')) continue
      s.pauseAnimations()
      s.setCurrentTime(${ms} / 1000)
    }
    for (const a of document.getAnimations()) {
      a.pause()
      a.currentTime = ${ms}
    }
  }
  freeze()
  addEventListener('load', freeze)
})()</script>`

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

let total = 24
const imgs = files.map((file) => {
  const svg = fs.readFileSync(file, 'utf8')
  const w = Number(svg.match(/<svg[^>]*\swidth="([\d.]+)"/)?.[1] ?? column)
  const hgt = Number(svg.match(/<svg[^>]*\sheight="([\d.]+)"/)?.[1] ?? 200)
  const shown = Math.min(column, w)
  const shownH = Math.ceil((hgt * shown) / w)
  total += shownH + 16
  if (!inline) {
    return `<img src="${pathToFileURL(file).href}" style="display:block;width:${shown}px;margin:0 auto 16px">`
  }
  const markup = svg.replace(/^﻿?\s*(<\?xml[\s\S]*?\?>\s*)?(<!DOCTYPE[^>]*>\s*)?/i, '')
  const doc =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;background:transparent;overflow:hidden}body>svg{display:block;width:100%;height:auto}</style>' +
    `</head><body>${markup}${freezeScript(time)}</body></html>`
  return `<iframe srcdoc="${attr(doc)}" scrolling="no" style="display:block;width:${shown}px;height:${shownH}px;border:0;margin:0 auto 16px;background:transparent"></iframe>`
})

const html = `<!doctype html><html><body style="margin:0;padding:12px 0;background:${bg}"><div style="width:${column}px;margin:0 auto">${imgs.join('')}</div></body></html>`
const tmp = path.join(os.tmpdir(), `profile-preview-${process.pid}.html`)
fs.writeFileSync(tmp, html)
chrome([
  `--window-size=${column + 40},${total}`,
  `--force-device-scale-factor=${scale}`,
  `--virtual-time-budget=${inline ? INLINE_BUDGET : time}`,
  `--screenshot=${out}`,
  pathToFileURL(tmp).href,
])
fs.rmSync(tmp, { force: true })
console.log(`preview → ${out} (${column + 40}×${total} @${scale}x${inline ? `, inline frame @${time}ms` : ''})`)
