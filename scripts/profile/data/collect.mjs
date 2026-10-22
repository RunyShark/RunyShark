// Placeholder collector: returns the cached metrics model until the live
// GitHub/WakaTime collector is implemented.

import fs from 'node:fs'
import path from 'node:path'

export async function collect({ root }) {
  const cache = path.join(root, 'assets', 'generated', 'metrics.json')
  return fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : {}
}
