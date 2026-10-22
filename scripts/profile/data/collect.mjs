// Metrics collector: GitHub + WakaTime → the metrics model (DESIGN.md §6),
// cached at assets/generated/metrics.json.
//
//   collect({ offline: true })  → the cached model, untouched (no network)
//   collect()                   → live fetch, per-source fallback, cache rewritten
//
// Fallback rules (never throws for API failures):
//   github   — live, or the cached GitHub keys            (sources.github = 'live' | 'cache')
//   wakatime — live; or 'partial' when only some endpoints answered (the rest
//              comes from the cache or the seed); or the cached block; or the seed
//                                                         (sources.wakatime = 'live' | 'partial' | 'cache' | 'seed')
//
// Timestamps: generatedAt is the time of this run. sources.githubAt / wakatimeAt
// are the time of the last successful live fetch of that source ('partial'
// counts as live); a source that falls back to the cache carries the cached
// timestamp forward (null when that source was never live).
//
// Env: GITHUB_TOKEN (or GH_TOKEN / METRICS_TOKEN), WAKATIME_API_KEY (or WAKATIME_TOKEN).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { profile } from '../content.mjs'
import { fetchGitHub, reconcileWithCache } from './github.mjs'
import { logger } from './http.mjs'
import { deriveContributions } from './stats.mjs'
import { fetchWakaTime, isSeedPart, normalizeWakaTime, seedWakaTime } from './wakatime.mjs'

export const SCHEMA_VERSION = 1
export const CACHE_FILE = path.join('assets', 'generated', 'metrics.json')
const GITHUB_KEYS = ['user', 'contributions', 'pullRequests', 'issues', 'repositoriesContributedTo', 'languages']
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const LOGIN = profile?.login || 'RunyShark'
const TIMEZONE = profile?.timezone || null
const log = logger('collect')

export function readCache(root = DEFAULT_ROOT) {
  const file = path.join(root, CACHE_FILE)
  if (!fs.existsSync(file)) return null
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object')
    if (data.schemaVersion !== SCHEMA_VERSION) {
      log.warn(`cache schemaVersion ${data.schemaVersion} ≠ ${SCHEMA_VERSION} — using it anyway`)
    }
    return data
  } catch (err) {
    log.warn(`ignoring unreadable cache ${CACHE_FILE}: ${err.message}`)
    return null
  }
}

// Pretty JSON that keeps short values on one line, so the 371-day calendar
// stays a readable ~400-line diff instead of ~2,000 lines. Deterministic.
const entriesOf = (v) => (Array.isArray(v) ? v.map((x) => [null, x]) : Object.entries(v).filter(([, x]) => x !== undefined))
const keyOf = (k) => (k === null ? '' : `${JSON.stringify(k)}: `)

function inline(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  const parts = entriesOf(value).map(([k, v]) => `${keyOf(k)}${inline(v)}`)
  if (Array.isArray(value)) return `[${parts.join(', ')}]`
  return parts.length ? `{ ${parts.join(', ')} }` : '{}'
}

export function formatJSON(value, indent = '') {
  const flat = inline(value)
  const isPrimitiveArray = Array.isArray(value) && value.every((v) => v === null || typeof v !== 'object')
  if (value === null || typeof value !== 'object' || isPrimitiveArray || indent.length + flat.length <= 110) return flat
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  const inner = `${indent}  `
  return `${open}\n${entriesOf(value).map(([k, v]) => `${inner}${keyOf(k)}${formatJSON(v, inner)}`).join(',\n')}\n${indent}${close}`
}

function writeCache(root, model) {
  const file = path.join(root, CACHE_FILE)
  const text = `${formatJSON(model)}\n`
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (previous === text) {
    log.info(`= ${CACHE_FILE} unchanged`)
    return
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // Atomic replace: concurrent readers never see a half-written file.
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, text)
  try {
    fs.renameSync(tmp, file)
  } catch {
    fs.writeFileSync(file, text)
    fs.rmSync(tmp, { force: true })
  }
  log.info(`✓ ${CACHE_FILE} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`)
}

function pick(source, keys) {
  const out = {}
  for (const k of keys) if (source?.[k] !== undefined) out[k] = source[k]
  return out
}

const isoOrNull = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

// Last live timestamp of a source in the cache. Caches written before the
// per-source timestamps existed only have generatedAt, which is right when that
// source was live in that run.
function cachedAt(cached, source) {
  const at = isoOrNull(cached?.sources?.[`${source}At`])
  if (at) return at
  const was = cached?.sources?.[source]
  return was === 'live' || was === 'partial' ? isoOrNull(cached?.generatedAt) : null
}

// The cached GitHub keys, upgraded with the fields derivable from them.
function cachedGitHub(cached) {
  const part = pick(cached, GITHUB_KEYS)
  if (part.contributions) part.contributions = deriveContributions(part.contributions, { timezone: TIMEZONE })
  if (part.user && part.user.totalCommits === undefined) part.user = { ...part.user, totalCommits: null }
  return part
}

async function collectGitHub(env, cached, now) {
  const fromCache = () => ({ part: cachedGitHub(cached), source: 'cache', at: cachedAt(cached, 'github') })
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || env.METRICS_TOKEN
  if (!token) {
    log.warn('no GITHUB_TOKEN — keeping cached GitHub data')
    return fromCache()
  }
  try {
    const { part, visibility, partial } = await fetchGitHub({ token, login: LOGIN, now, timezone: TIMEZONE })
    if (partial.includes('languages')) part.languages = cached?.languages ?? null
    if (partial.includes('stars')) part.user.stars = cached?.user?.stars ?? null
    const prevCommits = Number.isInteger(cached?.user?.totalCommits) ? cached.user.totalCommits : null
    if (partial.includes('totalCommits')) part.user.totalCommits = prevCommits
    if (partial.includes('totalCommits:min') && prevCommits !== null && prevCommits > (part.user.totalCommits ?? -1)) {
      log.warn(`search/commits was incomplete — keeping the higher cached total ${prevCommits}`)
      part.user.totalCommits = prevCommits
    }
    return { part: reconcileWithCache(part, cached, visibility), source: 'live', at: now.toISOString() }
  } catch (err) {
    log.error(`GitHub collection failed: ${err.message} — keeping cached GitHub data`)
    return fromCache()
  }
}

async function collectWakaTime(env, cached, now) {
  // A seeded part is a placeholder, not data: never hand it on as a cache.
  const block = cached?.wakatime && cached.sources?.wakatime !== 'seed' ? cached.wakatime : null
  const previous = block
    ? {
        allTime: !block.allTime || isSeedPart('allTime', block.allTime) ? null : block.allTime,
        lastYear: !block.lastYear || isSeedPart('lastYear', block.lastYear) ? null : block.lastYear,
      }
    : null
  const apiKey = env.WAKATIME_API_KEY || env.WAKATIME_TOKEN
  if (apiKey) {
    try {
      const { part, live, range } = await fetchWakaTime({ apiKey, cached: previous })
      const full = live.includes('allTime') && live.includes('lastYear') && range === 'last_year'
      if (!full) log.warn(`wakatime: partial — live: ${live.join(', ') || 'none'}${range ? ` · stats range ${range}` : ''}`)
      return { part, source: full ? 'live' : 'partial', at: now.toISOString() }
    } catch (err) {
      log.error(`WakaTime collection failed: ${err.message}`)
    }
  } else {
    log.warn('no WAKATIME_API_KEY')
  }
  if (block) {
    log.info('wakatime: keeping cached data')
    return { part: normalizeWakaTime(block), source: 'cache', at: cachedAt(cached, 'wakatime') }
  }
  log.info('wakatime: using the built-in seed')
  return { part: seedWakaTime(), source: 'seed', at: null }
}

export async function collect({ offline = false, root = DEFAULT_ROOT, env = process.env } = {}) {
  const cached = readCache(root)

  if (offline) {
    if (!cached) {
      log.warn(`offline and no ${CACHE_FILE}: rendering with the WakaTime seed only`)
      return {
        schemaVersion: SCHEMA_VERSION,
        generatedAt: null,
        sources: { wakatime: 'seed', githubAt: null, wakatimeAt: null },
        wakatime: seedWakaTime(),
      }
    }
    const s = cached.sources ?? {}
    log.info(
      `offline: cached metrics from ${cached.generatedAt ?? 'unknown date'} ` +
        `(github: ${s.github ?? '—'}${s.githubAt ? ` @ ${s.githubAt}` : ''}, wakatime: ${s.wakatime ?? '—'}${s.wakatimeAt ? ` @ ${s.wakatimeAt}` : ''})`,
    )
    return cached
  }

  const now = new Date()
  // Defensive: a bug in a collector must never break the render. Each source
  // is guarded on its own, so one failing does not discard the other.
  const guard = async (name, run, fallback) => {
    try {
      return await run()
    } catch (err) {
      log.error(`unexpected ${name} collector error: ${err?.stack || err}`)
      return fallback()
    }
  }
  const github = await guard('github', () => collectGitHub(env, cached, now), () => ({
    part: pick(cached, GITHUB_KEYS),
    source: 'cache',
    at: cachedAt(cached, 'github'),
  }))
  const wakatime = await guard('wakatime', () => collectWakaTime(env, cached, now), () =>
    cached?.wakatime && cached.sources?.wakatime !== 'seed'
      ? { part: cached.wakatime, source: 'cache', at: cachedAt(cached, 'wakatime') }
      : { part: seedWakaTime(), source: 'seed', at: null },
  )

  const model = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    sources: { github: github.source, wakatime: wakatime.source, githubAt: github.at ?? null, wakatimeAt: wakatime.at ?? null },
    ...pick(github.part, GITHUB_KEYS),
    wakatime: wakatime.part,
  }
  try {
    writeCache(root, model)
  } catch (err) {
    log.error(`could not write ${CACHE_FILE}: ${err.message}`)
  }
  const s = model.sources
  log.info(`sources → github: ${s.github} (${s.githubAt ?? 'never live'}), wakatime: ${s.wakatime} (${s.wakatimeAt ?? 'never live'})`)
  return model
}
