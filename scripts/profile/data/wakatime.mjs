// WakaTime collector → the `wakatime` block of the metrics model (DESIGN.md §6).
//
//   allTime  ← GET /users/current/all_time_since_today
//   lastYear ← GET /users/current/stats/last_year   (fallback last_30_days → last_7_days)
//
// WakaTime answers 202 (or is_up_to_date:false) while it is still computing a
// range; that counts as "unavailable" and the next fallback is tried. Each part
// falls back independently to the cached value (then to the seed).
//
// lastYear.range records which stats range the block describes. A shorter range
// is never passed off as a year:
//   - last_year not ready + a cached annual block → keep the whole cached block
//     (range 'last_year'; mixing a 30-day mix with a yearly total would lie);
//   - last_year not ready + no annual block → the shorter range's mix, daily
//     average and best day, with range set accordingly and totalSeconds = null
//     (components show "—" for the yearly total and label the rest by range).

import { logger, request } from './http.mjs'

const API = 'https://wakatime.com/api/v1/users/current'
const RANGES = ['last_year', 'last_30_days', 'last_7_days']
const log = logger('wakatime')
const intFmt = new Intl.NumberFormat('en-US')

export const hoursText = (seconds) => `${intFmt.format(Math.round(seconds / 3600))} hrs`

// Real values from the user's WakaTime dashboard (no API key is available
// locally). Used until a live run succeeds; sources.wakatime === 'seed'.
const SEED_LAST_YEAR_SECONDS = 9_144_000 // ≈ 2,540 h
const SEED_LANGUAGES = [
  ['TypeScript', 55],
  ['Other', 10],
  ['Markdown', 9],
  ['JSON', 6],
  ['Bash', 4],
]
export const WAKATIME_SEED = Object.freeze({
  allTime: { totalSeconds: 5_186 * 3600, text: hoursText(5_186 * 3600), since: null },
  lastYear: {
    range: 'last_year',
    totalSeconds: SEED_LAST_YEAR_SECONDS,
    dailyAverageSeconds: 26_160, // 7h 16m
    languages: SEED_LANGUAGES.map(([name, percent]) => ({
      name,
      percent,
      totalSeconds: Math.round((SEED_LAST_YEAR_SECONDS * percent) / 100),
    })),
    editors: [{ name: 'VS Code', percent: 100 }],
    operatingSystems: [{ name: 'Windows', percent: 100 }],
    bestDay: null,
  },
})

export const seedWakaTime = () => JSON.parse(JSON.stringify(WAKATIME_SEED))

// Is this cached part (allTime | lastYear) just the seed? (range-insensitive, so
// caches written before lastYear.range existed are recognised too)
const withoutRange = (v) => {
  if (!v || typeof v !== 'object') return v
  const { range, ...rest } = v
  return rest
}
export function isSeedPart(key, value) {
  if (!value || !WAKATIME_SEED[key]) return false
  return JSON.stringify(withoutRange(value)) === JSON.stringify(withoutRange(WAKATIME_SEED[key]))
}

// A real yearly block: range last_year (blocks cached before `range` existed
// were always yearly) with a yearly total.
export const isAnnualBlock = (ly) =>
  Boolean(ly) && (ly.range === undefined || ly.range === 'last_year') && Number.isFinite(ly.totalSeconds)

// Cached blocks written before `range` existed describe the last year.
export function normalizeWakaTime(block) {
  if (!block || typeof block !== 'object') return block
  const ly = block.lastYear
  if (!ly || typeof ly !== 'object' || ly.range !== undefined) return block
  return { ...block, lastYear: { range: 'last_year', ...ly } }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
const r1 = (v) => (num(v) === null ? null : Math.round(Number(v) * 10) / 10)
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

async function get(apiKey, path, label) {
  const res = await request(`${API}/${path}`, {
    headers: { authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`, accept: 'application/json' },
    timeout: 30_000,
    retries: 2,
    backoff: 2_000,
    accept: [202],
    label,
    log,
  })
  if (res.status === 202) return { pending: true }
  return { data: res.json?.data ?? null }
}

function mapAllTime(d) {
  const totalSeconds = num(d?.total_seconds)
  if (totalSeconds === null) return null
  return {
    totalSeconds: Math.round(totalSeconds),
    text: hoursText(totalSeconds),
    since: isoDate(d.range?.start_date) ?? isoDate(d.range?.start),
  }
}

const mapShares = (list, limit, withSeconds) =>
  (Array.isArray(list) ? list : [])
    .filter((x) => x?.name && num(x.percent) !== null)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, limit)
    .map((x) => ({
      name: x.name,
      percent: r1(x.percent),
      ...(withSeconds ? { totalSeconds: Math.round(num(x.total_seconds) ?? 0) } : {}),
    }))

function mapStats(d, range) {
  const totalSeconds = num(d?.total_seconds)
  if (totalSeconds === null) return null
  const best = d.best_day
  return {
    range,
    totalSeconds: Math.round(totalSeconds),
    dailyAverageSeconds: Math.round(num(d.daily_average) ?? 0),
    languages: mapShares(d.languages, 10, true),
    editors: mapShares(d.editors, 5, false),
    operatingSystems: mapShares(d.operating_systems, 5, false),
    bestDay: best?.date && num(best.total_seconds) !== null
      ? { date: isoDate(best.date), totalSeconds: Math.round(best.total_seconds) }
      : null,
  }
}

const upToDate = (d) => d && d.is_up_to_date !== false && (!d.status || d.status === 'ok')

/**
 * @param {{ apiKey: string, cached?: object }} opts  cached = previous `wakatime`
 *   block, without seeded parts ({ allTime|null, lastYear|null } or null)
 * @returns {Promise<{ part: object, live: Array<'allTime'|'lastYear'>, range: string|null }>}
 *   live = parts fetched now; range = stats range of a live lastYear (else null)
 */
export async function fetchWakaTime({ apiKey, cached = null }) {
  if (!apiKey) throw new Error('no WAKATIME_API_KEY')
  const started = Date.now()
  const live = []

  let allTime = null
  try {
    const res = await get(apiKey, 'all_time_since_today', 'all_time_since_today')
    if (res.pending || !upToDate(res.data)) log.warn('all-time total is still being computed — unavailable for now')
    else allTime = mapAllTime(res.data)
    if (allTime) {
      live.push('allTime')
      log.info(`all time: ${allTime.text}${allTime.since ? ` since ${allTime.since}` : ''}`)
    }
  } catch (err) {
    log.warn(`all-time total failed: ${err.message}`)
  }

  let lastYear = null
  let liveRange = null
  const cachedAnnual = isAnnualBlock(cached?.lastYear)
  for (const range of RANGES) {
    if (range !== 'last_year' && cachedAnnual) {
      // A shorter range would only refresh the mix under a stale yearly total:
      // keep the cached yearly block whole instead.
      log.warn('stats/last_year unavailable — keeping the cached last-year block')
      break
    }
    try {
      const res = await get(apiKey, `stats/${range}`, `stats/${range}`)
      if (res.pending || !upToDate(res.data)) {
        log.warn(`stats/${range} not ready (pending/is_up_to_date:false) — trying next range`)
        continue
      }
      const mapped = mapStats(res.data, range)
      if (!mapped) continue
      if (range !== 'last_year') {
        // Not a year's worth: no yearly total; the rest is labelled by `range`.
        mapped.totalSeconds = null
        log.warn(`using ${range} (last_year unavailable, nothing cached): yearly total unknown`)
      }
      lastYear = mapped
      liveRange = range
      live.push('lastYear')
      log.info(`${range}: ${mapped.totalSeconds === null ? 'yearly total —' : hoursText(mapped.totalSeconds)}, ` +
        `${mapped.languages[0]?.name ?? '—'} first, ${mapped.editors[0]?.name ?? '—'} on ${mapped.operatingSystems[0]?.name ?? '—'}`)
      break
    } catch (err) {
      log.warn(`stats/${range} failed: ${err.message}`)
      if (err.status === 401 || err.status === 403) break
    }
  }

  if (!allTime && !lastYear) throw new Error('no WakaTime data available')
  const seed = seedWakaTime()
  const kept = []
  if (!allTime) kept.push(cached?.allTime ? 'allTime from cache' : 'allTime from seed')
  if (!lastYear) kept.push(cached?.lastYear ? 'lastYear from cache' : 'lastYear from seed')
  log.info(`done in ${((Date.now() - started) / 1000).toFixed(1)}s (live: ${live.join(', ')}${kept.length ? `; ${kept.join(', ')}` : ''})`)
  const part = normalizeWakaTime({
    allTime: allTime ?? cached?.allTime ?? seed.allTime,
    lastYear: lastYear ?? cached?.lastYear ?? seed.lastYear,
  })
  return { part, live, range: liveRange }
}
