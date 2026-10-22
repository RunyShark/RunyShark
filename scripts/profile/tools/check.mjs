#!/usr/bin/env node
// Quality gate for generated assets:
//   1. every SVG under assets/ is well-formed XML with <title>/<desc>
//   2. size budget for every SVG under assets/ and every local SVG the README shows
//      (e.g. profile-3d-contrib/): warn above 300 KB, fail above 900 KB
//   3. Chrome actually decodes it as an <img> (naturalWidth > 0)
//   4. every image URL referenced by README.md loads (remote ones over the network)
//   5. every <img> in README.md (outside HTML comments) and every ![alt](…) has a
//      non-empty alt text
//   6. remote README images only: each one is fetched once from Node (before Chrome,
//      so origins are measured cold) and its response time is reported; WARN above
//      3 s (GitHub's camo proxy gives up on slow origins), on a non-2xx status, on a
//      non-image content-type (camo refuses those) or when the fetch fails
//
//   node scripts/profile/tools/check.mjs [--no-remote]
//
// Warnings are printed but never change the exit code; problems exit 1.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chrome } from './chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const remote = !process.argv.includes('--no-remote')
const problems = []
const warnings = []

const WARN_KB = 300 // DESIGN.md §3.5: keep each SVG under 300 KB
const MAX_KB = 900
const SLOW_MS = 3000 // camo gives up on slow origins
const FETCH_TIMEOUT_MS = 15_000
const FETCH_CONCURRENCY = 4
const USER_AGENT = 'Mozilla/5.0 (compatible; runyshark-profile-check)'

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : p.endsWith('.svg') ? [p] : []
  })
}

// Minimal well-formedness check: balanced tags, quoted attributes, no stray '<' or '&'.
function wellFormed(xml) {
  const stack = []
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<|&(?![a-zA-Z]+;|#\d+;|#x[\da-fA-F]+;)/g
  let m
  while ((m = re.exec(xml))) {
    if (m[0] === '<') return `stray "<" at ${m.index}`
    if (m[0].startsWith('&')) return `unescaped "&" at ${m.index}`
    if (!m[2]) continue
    const [, closing, name, , selfClosing] = m
    if (closing) {
      const open = stack.pop()
      if (open !== name) return `</${name}> closes <${open}> at ${m.index}`
    } else if (!selfClosing) stack.push(name)
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null
}

function sizeBudget(rel, bytes) {
  const kb = bytes / 1024
  if (kb > MAX_KB) problems.push(`${rel}: ${kb.toFixed(0)} KB is too heavy for a README image`)
  else if (kb > WARN_KB) warnings.push(`${rel}: ${kb.toFixed(0)} KB is over the ${WARN_KB} KB budget (fails above ${MAX_KB} KB)`)
}

const svgs = walk(path.join(root, 'assets'))
for (const file of svgs) {
  const rel = path.relative(root, file)
  const xml = fs.readFileSync(file, 'utf8')
  const err = wellFormed(xml)
  if (err) problems.push(`${rel}: malformed XML — ${err}`)
  if (!/<title[\s>]/.test(xml) || !/<desc[\s>]/.test(xml)) problems.push(`${rel}: missing <title>/<desc>`)
  sizeBudget(rel, Buffer.byteLength(xml))
}

// README image references
const readme = fs.existsSync(path.join(root, 'README.md')) ? fs.readFileSync(path.join(root, 'README.md'), 'utf8') : ''
const refs = new Set()
for (const m of readme.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) refs.add(m[1])
for (const m of readme.matchAll(/srcset="([^"]+)"/g)) refs.add(m[1])
for (const m of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) refs.add(m[1])
const readmeRefs = [...refs].filter((u) => remote || !/^https?:/.test(u))
const localPath = (ref) => path.join(root, ref.replace(/^\.\//, ''))
const svgSet = new Set(svgs.map((f) => path.resolve(f)))
for (const ref of readmeRefs) {
  if (/^https?:/.test(ref)) continue
  const file = localPath(ref)
  if (!fs.existsSync(file)) problems.push(`README → ${ref}: file not found`)
  else if (/\.svg$/i.test(file) && !svgSet.has(path.resolve(file))) sizeBudget(path.relative(root, file), fs.statSync(file).size)
}

// Alt text: every <img> (quote-aware, so a '>' inside an attribute is fine) and every
// Markdown image. HTML comments are blanked first, keeping newlines for line numbers.
const visible = readme.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '))
const lineOf = (index) => visible.slice(0, index).split('\n').length
let altCount = 0
for (const m of visible.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
  altCount++
  const alt = m[0].match(/\salt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i)
  const src = m[0].match(/\ssrc\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? '(no src)'
  if (!alt) problems.push(`README.md:${lineOf(m.index)}: <img> has no alt — ${src.slice(0, 120)}`)
  else if (!(alt[1] ?? alt[2] ?? alt[3] ?? '').trim()) problems.push(`README.md:${lineOf(m.index)}: <img> has an empty alt — ${src.slice(0, 120)}`)
}
for (const m of visible.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
  altCount++
  if (!m[1].trim()) problems.push(`README.md:${lineOf(m.index)}: Markdown image has an empty alt — ${m[2].slice(0, 120)}`)
}

// Remote response times, measured from Node before Chrome warms any origin.
async function timeRemote(url) {
  const started = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    })
    const firstByte = performance.now() - started
    const bytes = (await res.arrayBuffer()).byteLength
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    return { url, status: res.status, type, bytes, firstByte, total: performance.now() - started }
  } catch (err) {
    const error = ctrl.signal.aborted ? `no complete response within ${FETCH_TIMEOUT_MS / 1000} s` : (err.cause?.message ?? err.message)
    return { url, error, total: performance.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

async function mapPool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

const remoteRefs = readmeRefs.filter((u) => /^https?:/.test(u))
if (remoteRefs.length) {
  const secs = (ms) => `${(ms / 1000).toFixed(2)} s`
  const short = (u) => {
    const s = u.replace(/^https?:\/\//, '')
    return s.length > 96 ? `${s.slice(0, 95)}…` : s
  }
  const timings = await mapPool(remoteRefs, FETCH_CONCURRENCY, timeRemote)
  console.log(`remote README images: ${remoteRefs.length} fetched, ${FETCH_CONCURRENCY} at a time (warn > ${SLOW_MS / 1000} s)`)
  for (const t of timings) {
    const detail = t.error
      ? `ERR  ${t.error}`
      : `${String(t.status).padEnd(4)} ttfb ${secs(t.firstByte).padStart(7)}  ${(t.bytes / 1024).toFixed(1).padStart(6)} KB  ${t.type.padEnd(13)}`
    console.log(`  ${secs(t.total).padStart(7)}  ${detail}  ${short(t.url)}`)
    if (t.error) warnings.push(`remote image fetch failed (${t.error}): ${short(t.url)}`)
    else {
      if (t.total > SLOW_MS) warnings.push(`remote image took ${secs(t.total)} (> ${SLOW_MS / 1000} s, GitHub's camo proxy may give up): ${short(t.url)}`)
      if (t.status < 200 || t.status > 299) warnings.push(`remote image answered HTTP ${t.status}: ${short(t.url)}`)
      else if (!t.type.startsWith('image/')) warnings.push(`remote image served as "${t.type || 'no content-type'}" (camo only proxies image/*): ${short(t.url)}`)
    }
  }
  const sorted = timings.map((t) => t.total).sort((a, b) => a - b)
  console.log(`  median ${secs(sorted[Math.floor((sorted.length - 1) / 2)])} · slowest ${secs(sorted.at(-1))}`)
}

// Decode everything in Chrome.
const urls = [
  ...svgs.map((f) => pathToFileURL(f).href),
  ...readmeRefs.map((u) => (/^https?:/.test(u) ? u : pathToFileURL(path.join(root, u.replace(/^\.\//, ''))).href)),
]
const html = `<!doctype html><body>${urls.map((u, i) => `<img id="i${i}" src="${u.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`).join('')}
<script>
window.addEventListener('load', () => {
  const r = [...document.images].map(i => i.complete && i.naturalWidth > 0 ? 1 : 0).join('')
  document.body.setAttribute('data-result', r)
})
</script></body>`
const tmp = path.join(os.tmpdir(), `profile-check-${process.pid}.html`)
fs.writeFileSync(tmp, html)
const dom = chrome(['--virtual-time-budget=20000', '--dump-dom', pathToFileURL(tmp).href], { timeout: 120_000 })
fs.rmSync(tmp, { force: true })
const result = dom.match(/data-result="([01]*)"/)?.[1] ?? ''
urls.forEach((u, i) => {
  if (result[i] !== '1') problems.push(`does not render in Chrome: ${decodeURIComponent(u).slice(0, 160)}`)
})

console.log(`checked ${svgs.length} SVG(s), ${readmeRefs.length} README image(s), ${altCount} README alt text(s)`)
if (warnings.length) console.warn(warnings.map((w) => `! ${w}`).join('\n'))
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log(`✓ all assets well-formed and rendering${warnings.length ? ` (${warnings.length} warning(s))` : ''}`)
