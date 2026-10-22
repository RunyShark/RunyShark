// Extract the brand icons the profile uses from the simple-icons npm packages.
//
// Usage (one-off, only when content.mjs gains a new icon slug):
//   node scripts/profile/tools/vendor_icons.mjs <simple-icons@latest pkg dir> <simple-icons@9 pkg dir>
//
// Brands removed from recent simple-icons releases (AWS, OpenAI, LinkedIn, Slack…)
// are taken from the older package. Output: scripts/profile/vendor/icons.json
// simple-icons is CC0-1.0; logos remain trademarks of their owners.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extraIcons, stack } from '../content.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const [latestDir, legacyDir] = process.argv.slice(2)
if (!latestDir || !legacyDir) {
  console.error('usage: node vendor_icons.mjs <simple-icons latest dir> <simple-icons v9 dir>')
  process.exit(1)
}

function loadPackage(dir) {
  const candidates = ['data/simple-icons.json', '_data/simple-icons.json']
  const file = candidates.map((c) => path.join(dir, c)).find((p) => fs.existsSync(p))
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const list = Array.isArray(raw) ? raw : raw.icons
  return { dir, hex: new Map(list.map((i) => [i.slug ?? slugify(i.title), i.hex])) }
}

// Mirrors simple-icons' titleToSlug for packages whose data lacks explicit slugs.
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/\./g, 'dot')
    .replace(/&/g, 'and')
    .replace(/đ/g, 'd')
    .replace(/ħ/g, 'h')
    .replace(/ı/g, 'i')
    .replace(/ĸ/g, 'k')
    .replace(/ŀ/g, 'l')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/ŧ/g, 't')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function readIcon(pkg, slug) {
  const file = path.join(pkg.dir, 'icons', `${slug}.svg`)
  if (!fs.existsSync(file)) return null
  const svg = fs.readFileSync(file, 'utf8')
  const title = svg.match(/<title>(.*?)<\/title>/)?.[1] ?? slug
  const d = svg.match(/<path d="([^"]+)"/)?.[1]
  if (!d) return null
  return { title, hex: pkg.hex.get(slug) ?? null, path: d }
}

const latest = loadPackage(latestDir)
const legacy = loadPackage(legacyDir)
const slugs = new Set([...stack.flatMap((g) => g.items.map((i) => i.icon)), ...extraIcons].filter(Boolean))

const icons = {}
const missing = []
for (const slug of [...slugs].sort()) {
  const fromLatest = readIcon(latest, slug)
  const icon = fromLatest ?? readIcon(legacy, slug)
  if (!icon) {
    missing.push(slug)
    continue
  }
  icons[slug] = { ...icon, source: fromLatest ? 'latest' : 'v9' }
}

const dest = path.join(here, '..', 'vendor', 'icons.json')
fs.writeFileSync(dest, JSON.stringify(icons))
console.log(`wrote ${Object.keys(icons).length} icons -> ${dest}`)
if (missing.length) console.warn(`missing (will render as monogram): ${missing.join(', ')}`)
