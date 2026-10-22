#!/usr/bin/env node
// Quality gate for generated assets:
//   1. every SVG under assets/ is well-formed XML with <title>/<desc>
//   2. Chrome actually decodes it as an <img> (naturalWidth > 0)
//   3. every image URL referenced by README.md loads (remote ones over the network)
//
//   node scripts/profile/tools/check.mjs [--no-remote]

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chrome } from './chrome.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const remote = !process.argv.includes('--no-remote')
const problems = []

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

const svgs = walk(path.join(root, 'assets'))
for (const file of svgs) {
  const rel = path.relative(root, file)
  const xml = fs.readFileSync(file, 'utf8')
  const err = wellFormed(xml)
  if (err) problems.push(`${rel}: malformed XML — ${err}`)
  if (!/<title[\s>]/.test(xml) || !/<desc[\s>]/.test(xml)) problems.push(`${rel}: missing <title>/<desc>`)
  const kb = Buffer.byteLength(xml) / 1024
  if (kb > 900) problems.push(`${rel}: ${kb.toFixed(0)} KB is too heavy for a README image`)
}

// README image references
const readme = fs.existsSync(path.join(root, 'README.md')) ? fs.readFileSync(path.join(root, 'README.md'), 'utf8') : ''
const refs = new Set()
for (const m of readme.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) refs.add(m[1])
for (const m of readme.matchAll(/srcset="([^"]+)"/g)) refs.add(m[1])
for (const m of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) refs.add(m[1])
const readmeRefs = [...refs].filter((u) => remote || !/^https?:/.test(u))
for (const ref of readmeRefs) {
  if (!/^https?:/.test(ref) && !fs.existsSync(path.join(root, ref.replace(/^\.\//, '')))) {
    problems.push(`README → ${ref}: file not found`)
  }
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

console.log(`checked ${svgs.length} SVG(s), ${readmeRefs.length} README image(s)`)
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log('✓ all assets well-formed and rendering')
