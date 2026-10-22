// Locates a Chrome/Chromium/Edge binary for headless previews and checks.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

export function findChrome() {
  const found = CANDIDATES.find((p) => p && fs.existsSync(p))
  if (!found) throw new Error('No Chrome/Edge found — set CHROME_PATH')
  return found
}

export function chrome(args, { timeout = 60_000 } = {}) {
  return execFileSync(
    findChrome(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--allow-file-access-from-files',
      ...(process.env.CI ? ['--no-sandbox'] : []),
      ...args,
    ],
    { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  )
}
