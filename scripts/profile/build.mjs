#!/usr/bin/env node
// Profile asset pipeline: collect metrics → render every SVG component → write.
//
//   node scripts/profile/build.mjs              # live data (GITHUB_TOKEN, WAKATIME_API_KEY)
//   node scripts/profile/build.mjs --offline    # render from the cached metrics only
//   node scripts/profile/build.mjs --only hero,about
//
// Each component module default-exports { name, render({ data }) → [{ path, svg }] }.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const offline = args.includes('--offline')
const onlyArg = args.find((a) => a.startsWith('--only'))
const only = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1]).split(',')
  : null

const COMPONENTS = [
  'hero',
  'buttons',
  'sections',
  'about',
  'impact',
  'activity',
  'coding',
  'stack',
  'certifications',
  'github',
  'achievements',
  'footer',
]

async function loadData() {
  const { collect } = await import('./data/collect.mjs')
  return collect({ offline, root })
}

async function main() {
  const started = Date.now()
  const data = await loadData()
  const selected = COMPONENTS.filter((name) => !only || only.includes(name))
  let written = 0
  for (const name of selected) {
    const file = path.join(root, 'scripts', 'profile', 'components', `${name}.mjs`)
    if (!fs.existsSync(file)) {
      console.warn(`skip ${name}: component not implemented`)
      continue
    }
    const { default: component } = await import(`./components/${name}.mjs`)
    for (const out of component.render({ data })) {
      const dest = path.join(root, out.path)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const previous = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null
      if (previous !== out.svg) {
        fs.writeFileSync(dest, out.svg)
        written += 1
      }
      console.log(`${previous === out.svg ? '=' : '✓'} ${out.path} (${(Buffer.byteLength(out.svg) / 1024).toFixed(1)} KB)`)
    }
  }
  console.log(`done in ${Date.now() - started} ms — ${written} file(s) changed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
