#!/usr/bin/env node
// Full-page preview of README.md exactly as GitHub renders it on the profile page:
//   1. README.md → GitHub's own Markdown API (gfm, repo context) — same sanitiser, camo
//      image proxy and <picture> handling as github.com
//   2. wrapped in github-markdown-css (dark) inside the profile README box
//      (846px column, 24px padding, on #0d1117); relative image paths point at the
//      local working tree, so unpushed assets show up
//   3. headless Chrome screenshot (tall window), then sliced into PNG chunks (Pillow)
//
//   node scripts/profile/tools/preview-readme.mjs [--out-dir DIR] [--prefix readme]
//     [--scale 1] [--chunk 1100] [--time 6000] [--open] [--html page.html]
//
// --open expands every <details> block. Auth: GITHUB_TOKEN or `gh auth token`.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chrome } from './chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const outDir = path.resolve(opt('out-dir', path.join(os.tmpdir(), 'profile-readme-preview')))
const prefix = opt('prefix', 'readme')
const scale = Number(opt('scale', 1))
const chunk = Number(opt('chunk', 1100))
const budget = Number(opt('time', 6000))
const htmlOut = opt('html', null)
const openDetails = args.includes('--open')

const COLUMN = 846 // GitHub profile README content width
const BOX_PAD = 24
const PAGE_PAD = 24
const MARKDOWN_CSS = 'https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-dark.min.css'
const MAX_DEVICE_PX = 15000 // stay under Chrome's screenshot texture limit

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

async function renderMarkdown(text) {
  const auth = token()
  const res = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'runyshark-profile-preview',
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify({ text, mode: 'gfm', context: 'RunyShark/RunyShark' }),
  })
  if (!res.ok) throw new Error(`GitHub Markdown API → ${res.status} ${await res.text()}`)
  return res.text()
}

// Relative src/srcset → file:// URLs of the working tree (GitHub would serve them raw).
function localise(html) {
  const missing = new Set()
  const out = html.replace(/\b(src|srcset)="([^"]+)"/g, (all, attr, value) => {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return all
    const file = path.join(root, decodeURI(value).replace(/^\.?\//, ''))
    if (!fs.existsSync(file)) {
      missing.add(value)
      return all
    }
    return `${attr}="${pathToFileURL(file).href}"`
  })
  return { html: out, missing: [...missing] }
}

function page(body, { offset = 0 } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${MARKDOWN_CSS}">
<style>
  html, body { margin: 0; background: #0d1117; }
  .page { width: ${COLUMN + 2 * BOX_PAD + 2}px; margin: ${PAGE_PAD - offset}px auto ${PAGE_PAD}px; }
  .box { border: 1px solid #3d444d; border-radius: 6px; }
  .box-head { padding: 8px 16px; font: 12px/20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
              color: #9198a1; border-bottom: 1px solid #3d444d; }
  .markdown-body { padding: ${BOX_PAD}px; background: #0d1117; }
</style></head><body>
<div class="page"><div class="box"><div class="box-head">RunyShark / README.md</div>
<article class="markdown-body entry-content container-lg">${body}</article></div></div>
<script>
  addEventListener('load', () => {
    const imgs = [...document.images]
    const broken = imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.alt || i.src)
    document.body.setAttribute('data-height', String(Math.ceil(document.documentElement.scrollHeight)))
    document.body.setAttribute('data-images', imgs.length + '/' + (imgs.length - broken.length))
    document.body.setAttribute('data-broken', encodeURIComponent(JSON.stringify(broken)))
  })
</script></body></html>`
}

function findPython() {
  for (const bin of [process.env.PYTHON, 'python', 'python3', 'py'].filter(Boolean)) {
    try {
      execFileSync(bin, ['-c', 'import PIL'], { stdio: 'ignore' })
      return bin
    } catch {}
  }
  return null
}

const SLICE_PY = `
import sys
from PIL import Image
out_dir, prefix, chunk = sys.argv[1], sys.argv[2], int(sys.argv[3])
n = 0
for seg in sys.argv[4:]:
    im = Image.open(seg).convert('RGB')
    w, h = im.size
    y = 0
    while y < h:
        n += 1
        im.crop((0, y, w, min(y + chunk, h))).save(f'{out_dir}/{prefix}-{n:02d}.png', optimize=True)
        y += chunk
print(n)
`

async function main() {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  let body = await renderMarkdown(readme)
  if (openDetails) body = body.replace(/<details>/g, '<details open>')
  const local = localise(body)
  body = local.html

  fs.mkdirSync(outDir, { recursive: true })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-preview-'))
  const winWidth = COLUMN + 2 * BOX_PAD + 2 + 2 * PAGE_PAD

  // Pass 1: let every image load, then measure the page and list broken images.
  const measureFile = path.join(tmp, 'measure.html')
  fs.writeFileSync(measureFile, page(body))
  const dom = chrome(
    [`--window-size=${winWidth},1200`, `--virtual-time-budget=${budget}`, '--dump-dom', pathToFileURL(measureFile).href],
    { timeout: 180_000 },
  )
  const height = Number(dom.match(/data-height="(\d+)"/)?.[1] ?? 0)
  const images = dom.match(/data-images="([^"]+)"/)?.[1] ?? '?'
  const broken = JSON.parse(decodeURIComponent(dom.match(/data-broken="([^"]*)"/)?.[1] ?? '%5B%5D'))
  if (!height) throw new Error('could not measure the rendered README')
  if (htmlOut) fs.writeFileSync(path.resolve(htmlOut), page(body))

  // Pass 2: screenshot in segments that are whole multiples of the chunk height.
  const perSegment = Math.max(1, Math.floor(MAX_DEVICE_PX / (chunk * scale))) * chunk
  const segments = []
  for (let offset = 0; offset < height; offset += perSegment) {
    const h = Math.min(perSegment, height - offset)
    const file = path.join(tmp, `segment-${segments.length}.html`)
    const png = path.join(tmp, `segment-${segments.length}.png`)
    fs.writeFileSync(file, page(body, { offset }))
    chrome(
      [
        `--window-size=${winWidth},${h}`,
        `--force-device-scale-factor=${scale}`,
        `--virtual-time-budget=${budget}`,
        `--screenshot=${png}`,
        pathToFileURL(file).href,
      ],
      { timeout: 180_000 },
    )
    segments.push(png)
  }

  // Slice into chunks (drop stale chunks from a previous, longer run first).
  for (const f of fs.readdirSync(outDir)) {
    if (new RegExp(`^${prefix}-\\d+\\.png$`).test(f)) fs.rmSync(path.join(outDir, f))
  }
  const python = findPython()
  let written = []
  if (python) {
    execFileSync(python, ['-c', SLICE_PY, outDir, prefix, String(chunk * scale), ...segments], { stdio: 'ignore' })
    written = fs.readdirSync(outDir).filter((f) => new RegExp(`^${prefix}-\\d+\\.png$`).test(f)).sort()
  } else {
    segments.forEach((s, i) => {
      const dest = path.join(outDir, `${prefix}-${String(i + 1).padStart(2, '0')}.png`)
      fs.copyFileSync(s, dest)
      written.push(path.basename(dest))
    })
    console.warn('Pillow not found: wrote whole segments instead of chunks')
  }
  fs.rmSync(tmp, { recursive: true, force: true })

  console.log(`README rendered via GitHub API → ${height}px tall @${scale}x, images loaded ${images}`)
  if (local.missing.length) console.warn(`missing local files: ${local.missing.join(', ')}`)
  if (broken.length) console.warn(`broken images:\n  ${broken.join('\n  ')}`)
  console.log(written.map((f) => path.join(outDir, f)).join('\n'))
  if (local.missing.length || broken.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
