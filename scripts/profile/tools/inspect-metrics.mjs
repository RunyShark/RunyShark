#!/usr/bin/env node
// Validate assets/generated/metrics.json field by field against DESIGN.md §6 and
// print a human summary. Exit code 1 on any error (warnings don't fail).
//
//   node scripts/profile/tools/inspect-metrics.mjs [path/to/metrics.json]
//   node scripts/profile/tools/inspect-metrics.mjs --selftest   # streak/calendar/WakaTime logic on synthetic data

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addDays,
  computeContributions,
  contributionTotals,
  countActiveWeeks,
  daysBetween,
  deriveContributions,
  weekdayOf,
  weeklyStreaks,
  weekStartOf,
} from '../data/stats.mjs'
import { fetchWakaTime, isAnnualBlock, isSeedPart, normalizeWakaTime, seedWakaTime } from '../data/wakatime.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const args = process.argv.slice(2)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmt = new Intl.NumberFormat('en-US')
const n = (v) => (Number.isFinite(v) ? fmt.format(v) : '—')

const errors = []
const warnings = []
let passed = 0
const check = (ok, msg) => (ok ? (passed += 1) : errors.push(msg))
const warn = (ok, msg) => (ok ? (passed += 1) : warnings.push(msg))

const isInt = (v, min = 0) => Number.isInteger(v) && v >= min
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const isISO = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const near = (a, b, eps) => isNum(a) && isNum(b) && Math.abs(a - b) <= eps
const sum = (xs) => xs.reduce((s, x) => s + x, 0)

// ── selftest ────────────────────────────────────────────────────────────────
function selftest() {
  // Wed 2026-10-21 is "today"; rolling window = Sunday-aligned 53 weeks.
  const today = '2026-10-21'
  const start = addDays(today, -(52 * 7 + weekdayOf(today)))
  const window = (fn) => {
    const days = []
    for (let d = start; d <= today; d = addDays(d, 1)) days.push({ date: d, contributionCount: fn(d) })
    return { total: sum(days.map((d) => d.contributionCount)), days }
  }
  const yearOf = (y, fn) => {
    const days = []
    for (let d = `${y}-01-01`; d <= `${y}-12-31`; d = addDays(d, 1)) days.push({ date: d, contributionCount: fn(d) })
    return { year: y, total: sum(days.filter((d) => d.date <= today).map((d) => d.contributionCount)), days }
  }
  const run = (fn) => computeContributions({ rolling: window(fn), years: [2024, 2025, 2026].map((y) => yearOf(y, fn)) })
  const lastN = (k) => (d) => (daysBetween(d, today) < k ? 3 : 0)
  const cases = [
    ['today active, 5-day streak', run(lastN(5)), { days: 5, start: addDays(today, -4), end: today }],
    ['today 0 so far, streak alive until yesterday', run((d) => (d === today ? 0 : lastN(6)(d))), { days: 5, start: addDays(today, -5), end: addDays(today, -1) }],
    ['today and yesterday 0 → broken', run((d) => (daysBetween(d, today) >= 2 && daysBetween(d, today) < 9 ? 1 : 0)), { days: 0, start: null, end: null }],
    ['streak older than the window', run((d) => (d >= '2025-06-01' ? 1 : 0)), { days: daysBetween('2025-06-01', today) + 1, start: '2025-06-01', end: today }],
  ]
  for (const [name, c, expect] of cases) {
    const got = c.currentStreak
    check(got.days === expect.days && got.start === expect.start && got.end === expect.end,
      `selftest "${name}": currentStreak ${JSON.stringify(got)} ≠ ${JSON.stringify(expect)}`)
    check(c.longestStreak.days >= got.days, `selftest "${name}": longest < current`)
    check(c.calendar.length === 368 && weekdayOf(c.calendar[0].date) === 0, `selftest "${name}": calendar shape`)
    check(c.monthly.length === 12 && c.monthly.at(-1).month === '2026-10', `selftest "${name}": monthly shape`)
  }
  // Longest streak across a year boundary, before the rolling window.
  const across = run((d) => (d >= '2024-12-20' && d <= '2025-01-10' ? 2 : 0))
  check(across.longestStreak.days === 22 && across.longestStreak.start === '2024-12-20',
    `selftest longest across years: ${JSON.stringify(across.longestStreak)}`)
  check(across.currentStreak.days === 0 && across.lastYear === 0 && across.yoyGrowth === -1,
    'selftest empty window: zero streak, yoy −100%')
  check(across.bestDay === null && across.busiestWeekday === null, 'selftest empty window: no best day/weekday')
  check(across.weeklyStreak.longest.weeks === 4 && across.weeklyStreak.longest.start === '2024-12-15' && across.weeklyStreak.longest.end === '2025-01-11',
    `selftest weekly longest across years: ${JSON.stringify(across.weeklyStreak.longest)}`)
  check(across.weeklyStreak.current.weeks === 0 && across.weeklyStreak.current.start === null, 'selftest weekly current is 0 after the run')

  // ── weekly streaks on small synthetic maps ──
  const map = (dates) => new Map(dates.map((d) => [d, { date: d, count: 1 }]))
  const days = (from, to, every = 1) => {
    const out = []
    for (let d = from; d <= to; d = addDays(d, every)) out.push(d)
    return out
  }
  const zeroFill = (m, from, to) => {
    for (let d = from; d <= to; d = addDays(d, 1)) if (!m.has(d)) m.set(d, { date: d, count: 0 })
    return m
  }
  const same = (got, weeks, start, end) => got.weeks === weeks && got.start === start && got.end === end
  const wk = (name, got, weeks, start, end) =>
    check(same(got, weeks, start, end), `selftest weekly "${name}": ${JSON.stringify(got)} ≠ ${JSON.stringify({ weeks, start, end })}`)
  // today = Wed 2026-10-21; week of today = Sun 2026-10-18 … Sat 10-24.
  const sixWeeks = days('2026-09-06', '2026-10-17', 7) // one Sunday per week, Sep 6 → Oct 11 weeks
  let r = weeklyStreaks(zeroFill(map(sixWeeks), '2026-08-01', today), today)
  wk('current week empty so far', r.current, 6, '2026-09-06', '2026-10-17')
  wk('current week empty so far (longest)', r.longest, 6, '2026-09-06', '2026-10-17')
  r = weeklyStreaks(zeroFill(map([...sixWeeks, '2026-10-18']), '2026-08-01', today), today)
  wk('current week active → end capped at today', r.current, 7, '2026-09-06', today)
  r = weeklyStreaks(zeroFill(map(['2026-09-06', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-17']), '2026-08-01', today), today)
  wk('a 0-week breaks the run', r.current, 4, '2026-09-20', '2026-10-17')
  wk('a 0-week breaks the run (longest)', r.longest, 4, '2026-09-20', '2026-10-17')
  r = weeklyStreaks(zeroFill(map(['2026-10-03', '2026-10-05']), '2026-08-01', today), today)
  wk('current and previous week empty → broken', r.current, 0, null, null)
  wk('broken run still the longest', r.longest, 2, '2026-09-27', '2026-10-10')
  // Saturday then Sunday: two different weeks; a Sunday "today".
  r = weeklyStreaks(zeroFill(map(['2026-10-17']), '2026-10-01', '2026-10-18'), '2026-10-18')
  wk('today is Sunday with 0 → previous week counts', r.current, 1, '2026-10-11', '2026-10-17')
  r = weeklyStreaks(zeroFill(map(['2026-10-17', '2026-10-18']), '2026-10-01', '2026-10-18'), '2026-10-18')
  wk('today is Sunday and active', r.current, 2, '2026-10-11', '2026-10-18')
  r = weeklyStreaks(zeroFill(map(['2026-10-24']), '2026-10-01', '2026-10-24'), '2026-10-24')
  wk('today is Saturday and active', r.current, 1, '2026-10-18', '2026-10-24')
  // Year boundary: Sun 2024-12-29 … Sat 2025-01-04 is ONE week.
  r = weeklyStreaks(zeroFill(map(['2024-12-30', '2025-01-04']), '2024-12-01', '2025-01-31'), '2025-01-31')
  wk('one week across New Year', r.longest, 1, '2024-12-29', '2025-01-04')
  r = weeklyStreaks(zeroFill(map(['2024-12-28', '2024-12-31', '2025-01-05']), '2024-12-01', '2025-01-31'), '2025-01-31')
  wk('three weeks across New Year', r.longest, 3, '2024-12-22', '2025-01-11')
  // Leap day: Sun 2024-02-25 … Sat 2024-03-02 holds Feb 29.
  r = weeklyStreaks(zeroFill(map(['2024-02-29', '2024-03-03']), '2024-02-01', '2024-03-31'), '2024-03-31')
  wk('leap-day week', r.longest, 2, '2024-02-25', '2024-03-09')
  // All zero / empty / today before the data.
  r = weeklyStreaks(zeroFill(new Map(), '2026-01-01', today), today)
  wk('all-zero current', r.current, 0, null, null)
  wk('all-zero longest', r.longest, 0, null, null)
  r = weeklyStreaks(new Map(), today)
  wk('no data', r.longest, 0, null, null)
  // Ties keep the earliest run.
  r = weeklyStreaks(zeroFill(map(['2026-01-05', '2026-01-12', '2026-03-02', '2026-03-09']), '2026-01-01', today), today)
  wk('ties keep the earliest', r.longest, 2, '2026-01-04', '2026-01-17')

  // Through computeContributions: leap day + year boundary from per-year data.
  const leap = computeContributions({
    rolling: window(() => 0),
    years: [
      yearOf(2024, (d) => (['2024-02-28', '2024-02-29', '2024-03-01', '2024-12-31'].includes(d) ? 4 : 0)),
      yearOf(2025, (d) => (d === '2025-01-01' ? 4 : 0)),
      yearOf(2026, () => 0),
    ],
    timezone: 'America/Mexico_City',
  })
  check(leap.longestStreak.days === 3 && leap.longestStreak.start === '2024-02-28' && leap.longestStreak.end === '2024-03-01',
    `selftest leap-day daily streak: ${JSON.stringify(leap.longestStreak)}`)
  wk('per-year data: leap week first (earliest of equal runs)', leap.weeklyStreak.longest, 1, '2024-02-25', '2024-03-02')
  check(leap.weeklyStreak.current.weeks === 0 && leap.activeWeeks === 0 && leap.timezone === 'America/Mexico_City' && leap.windowDays === 368,
    'selftest all-zero window: current 0, activeWeeks 0, windowDays 368, timezone')

  // A live-like case: active every week since 2025-03-02, nothing today/this week.
  const steady = run((d) => (d >= '2025-03-02' && d < weekStartOf(today) && weekdayOf(d) === 2 ? 5 : 0))
  wk('steady weekly run, current week empty', steady.weeklyStreak.current, daysBetween('2025-03-02', weekStartOf(today)) / 7, '2025-03-02', addDays(weekStartOf(today), -1))
  check(steady.activeWeeks === 52 && steady.activeWeeks === countActiveWeeks(steady.calendar), `selftest activeWeeks ${steady.activeWeeks} ≠ 52`)
  check(steady.monthly.every((x, i) => x.partial === (i === 11)), 'selftest monthly.partial only on the current month')
  const t = contributionTotals([{ commits: 1, pullRequests: 2, issues: 3, reviews: 4 }, { commits: 10, pullRequests: 20, issues: 30, reviews: 40 }])
  check(t.commits === 11 && t.pullRequests === 22 && t.issues === 33 && t.reviews === 44, 'selftest totals')
  check(contributionTotals([]).commits === null, 'selftest totals without years → null')

  // deriveContributions upgrades an old cached block, never overwrites.
  const { windowDays, timezone, activeWeeks, totals, weeklyStreak, ...legacy } = steady
  legacy.monthly = legacy.monthly.map(({ partial, ...m }) => m)
  const up = deriveContributions(legacy, { timezone: 'America/Mexico_City' })
  check(up.windowDays === steady.windowDays && up.activeWeeks === steady.activeWeeks && up.timezone === 'America/Mexico_City' &&
    JSON.stringify(up.totals) === JSON.stringify(steady.totals) && up.monthly.every((x, i) => x.partial === steady.monthly[i].partial) &&
    up.weeklyStreak === undefined, 'selftest deriveContributions on a legacy block')
  check(deriveContributions({ ...steady, timezone: 'UTC' }, { timezone: 'X' }).timezone === 'UTC', 'selftest deriveContributions keeps values')
  check(deriveContributions(null) === null && deriveContributions({}).windowDays === undefined, 'selftest deriveContributions on empty input')

  return wakatimeSelftest()
}

// WakaTime range handling with a mocked fetch (no network, no files).
async function wakatimeSelftest() {
  const realFetch = globalThis.fetch
  const stats = (seconds) => ({
    data: {
      is_up_to_date: true, status: 'ok', total_seconds: seconds, daily_average: seconds / 30,
      languages: [{ name: 'TypeScript', percent: 80, total_seconds: seconds * 0.8 }, { name: 'JSON', percent: 20, total_seconds: seconds * 0.2 }],
      editors: [{ name: 'VS Code', percent: 100 }], operating_systems: [{ name: 'Windows', percent: 100 }],
      best_day: { date: '2026-10-01', total_seconds: 30_000 },
    },
  })
  const mock = (routes) => {
    globalThis.fetch = async (url) => {
      const key = Object.keys(routes).find((k) => String(url).endsWith(k))
      const [status, body] = routes[key] ?? [404, { message: 'nope' }]
      return new Response(body === null ? '' : JSON.stringify(body), { status })
    }
  }
  const allTime = [200, { data: { is_up_to_date: true, total_seconds: 20_000_000, range: { start_date: '2022-01-01' } } }]
  const quiet = console.log
  const quietWarn = console.warn
  try {
    console.log = () => {}
    console.warn = () => {}
    // last_year pending, nothing cached → 30-day mix, yearly total null.
    mock({ all_time_since_today: allTime, 'stats/last_year': [202, null], 'stats/last_30_days': [200, stats(360_000)] })
    let w = await fetchWakaTime({ apiKey: 'k', cached: null })
    check(w.range === 'last_30_days' && w.part.lastYear.range === 'last_30_days' && w.part.lastYear.totalSeconds === null &&
      w.part.lastYear.languages[0].name === 'TypeScript' && w.live.join() === 'allTime,lastYear',
      `selftest wakatime 30-day fallback: ${JSON.stringify({ range: w.range, live: w.live, total: w.part.lastYear.totalSeconds })}`)
    // last_year pending, annual block cached → the cached block whole.
    const cachedYear = { range: 'last_year', totalSeconds: 9_000_000, dailyAverageSeconds: 25_000, languages: [], editors: [], operatingSystems: [], bestDay: null }
    w = await fetchWakaTime({ apiKey: 'k', cached: { allTime: null, lastYear: cachedYear } })
    check(w.range === null && w.part.lastYear === cachedYear && w.live.join() === 'allTime', 'selftest wakatime keeps the cached annual block')
    // Legacy cached block without range counts as annual and gets range on the way out.
    const { range: _r, ...legacyYear } = cachedYear
    w = await fetchWakaTime({ apiKey: 'k', cached: { allTime: null, lastYear: legacyYear } })
    check(w.part.lastYear.range === 'last_year' && w.part.lastYear.totalSeconds === 9_000_000, 'selftest wakatime legacy cache normalised')
    // Everything live.
    mock({ all_time_since_today: allTime, 'stats/last_year': [200, stats(9_500_000)] })
    w = await fetchWakaTime({ apiKey: 'k', cached: null })
    check(w.range === 'last_year' && w.part.lastYear.totalSeconds === 9_500_000 && w.live.join() === 'allTime,lastYear', 'selftest wakatime fully live')
    // Only all-time live, nothing cached → seed lastYear (collect marks it 'partial').
    mock({ all_time_since_today: allTime, 'stats/last_year': [202, null], 'stats/last_30_days': [202, null], 'stats/last_7_days': [202, null] })
    w = await fetchWakaTime({ apiKey: 'k', cached: null })
    check(w.live.join() === 'allTime' && w.range === null && isSeedPart('lastYear', w.part.lastYear), 'selftest wakatime all-time only')
    // Nothing live → throws (collect falls back to cache/seed).
    mock({})
    let threw = false
    try {
      await fetchWakaTime({ apiKey: 'k', cached: null })
    } catch {
      threw = true
    }
    check(threw, 'selftest wakatime nothing live throws')
  } finally {
    globalThis.fetch = realFetch
    console.log = quiet
    console.warn = quietWarn
  }
  const seed = seedWakaTime()
  check(isSeedPart('lastYear', seed.lastYear) && isSeedPart('allTime', seed.allTime) && seed.lastYear.range === 'last_year', 'selftest seed recognised')
  const { range: _s, ...seedNoRange } = seed.lastYear
  check(isSeedPart('lastYear', seedNoRange) && !isSeedPart('lastYear', { ...seed.lastYear, totalSeconds: 1 }), 'selftest seed detection is range-insensitive and exact')
  check(isAnnualBlock({ totalSeconds: 1 }) && !isAnnualBlock({ range: 'last_30_days', totalSeconds: 1 }) && !isAnnualBlock({ range: 'last_year', totalSeconds: null }), 'selftest isAnnualBlock')
  check(normalizeWakaTime({ lastYear: { totalSeconds: 1 } }).lastYear.range === 'last_year' && normalizeWakaTime(null) === null, 'selftest normalizeWakaTime')

  console.log(`selftest: ${passed} checks passed, ${errors.length} failed`)
  if (errors.length) console.error(errors.map((e) => `✗ ${e}`).join('\n'))
  process.exit(errors.length ? 1 : 0)
}
if (args.includes('--selftest')) await selftest()

// ── load ────────────────────────────────────────────────────────────────────
const file = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(root, 'assets', 'generated', 'metrics.json'))
if (!fs.existsSync(file)) {
  console.error(`✗ ${file} not found`)
  process.exit(1)
}
const raw = fs.readFileSync(file, 'utf8')
let m
try {
  m = JSON.parse(raw)
} catch (err) {
  console.error(`✗ invalid JSON: ${err.message}`)
  process.exit(1)
}
check(!/\b(undefined|NaN|Infinity)\b/.test(raw), 'file contains "undefined"/"NaN"/"Infinity"')

// ── top level ───────────────────────────────────────────────────────────────
check(m.schemaVersion === 1, `schemaVersion ${m.schemaVersion} ≠ 1`)
check(isISO(m.generatedAt), `generatedAt not ISO: ${m.generatedAt}`)
const src = m.sources ?? {}
check(['live', 'cache'].includes(src.github), `sources.github = ${src.github}`)
check(['live', 'partial', 'cache', 'seed'].includes(src.wakatime), `sources.wakatime = ${src.wakatime}`)
for (const k of ['githubAt', 'wakatimeAt']) {
  check(src[k] === null || isISO(src[k]), `sources.${k} must be ISO or null: ${src[k]}`)
  if (isISO(src[k]) && isISO(m.generatedAt)) check(Date.parse(src[k]) <= Date.parse(m.generatedAt), `sources.${k} is after generatedAt`)
}
if (src.github === 'live') check(src.githubAt === m.generatedAt, `github is live but githubAt ${src.githubAt} ≠ generatedAt`)
if (src.wakatime === 'live' || src.wakatime === 'partial') check(src.wakatimeAt === m.generatedAt, `wakatime is ${src.wakatime} but wakatimeAt ${src.wakatimeAt} ≠ generatedAt`)
if (src.wakatime === 'seed') check(src.wakatimeAt === null, 'wakatime is seed but wakatimeAt is set')
warn(src.github === 'live', `GitHub data is cached (last live ${src.githubAt ?? 'never'})`)
warn(src.wakatime === 'live', `WakaTime is ${src.wakatime} (last live ${src.wakatimeAt ?? 'never'})`)

// ── user ────────────────────────────────────────────────────────────────────
const u = m.user ?? {}
check(typeof u.login === 'string' && u.login.length > 0, 'user.login')
check(typeof u.name === 'string' && u.name.length > 0, 'user.name')
check(isISO(u.createdAt), 'user.createdAt')
for (const k of ['followers', 'following', 'publicRepos', 'privateRepos', 'totalRepos', 'stars']) check(isInt(u[k]), `user.${k} = ${u[k]}`)
check(u.totalRepos === u.publicRepos + u.privateRepos, `user.totalRepos ${u.totalRepos} ≠ public ${u.publicRepos} + private ${u.privateRepos}`)
check(u.totalCommits === null || isInt(u.totalCommits), `user.totalCommits = ${u.totalCommits}`)
warn(isInt(u.totalCommits), 'user.totalCommits is missing (search/commits never succeeded)')
// yearsOnGitHub is computed when GitHub was last fetched, not when this file was written.
const githubTime = isISO(src.githubAt) ? src.githubAt : m.generatedAt
const years = (Date.parse(githubTime) - Date.parse(u.createdAt)) / (365.25 * 86_400_000)
check(near(u.yearsOnGitHub, years, 0.011), `user.yearsOnGitHub ${u.yearsOnGitHub} ≠ ${years.toFixed(2)}`)

// ── contributions ───────────────────────────────────────────────────────────
const c = m.contributions ?? {}
const cal = Array.isArray(c.calendar) ? c.calendar : []
const today = cal.at(-1)?.date
const byDate = new Map(cal.map((d) => [d.date, d]))
const countOf = (d) => byDate.get(d)?.count ?? 0

check(isInt(c.allTime) && isInt(c.lastYear), 'contributions.allTime/lastYear are non-negative integers')
check(c.windowDays === cal.length, `contributions.windowDays ${c.windowDays} ≠ calendar length ${cal.length}`)
let tzOk = false
try {
  tzOk = typeof c.timezone === 'string' && Boolean(new Intl.DateTimeFormat('en-US', { timeZone: c.timezone }).format(0))
} catch {
  tzOk = false
}
check(tzOk, `contributions.timezone is not an IANA zone: ${c.timezone}`)
check(c.previousYear === null || isInt(c.previousYear), `contributions.previousYear = ${c.previousYear}`)
if (c.previousYear > 0) check(near(c.yoyGrowth, c.lastYear / c.previousYear - 1, 1e-3), `yoyGrowth ${c.yoyGrowth} ≠ lastYear/previousYear − 1`)
else check(c.yoyGrowth === null, 'yoyGrowth must be null when previousYear is 0/null')

const by = Array.isArray(c.byYear) ? c.byYear : []
check(by.length > 0, 'byYear is empty')
check(by.every((y, i) => i === 0 || y.year === by[i - 1].year + 1), 'byYear years are not consecutive ascending')
check(by.every((y) => ['total', 'commits', 'pullRequests', 'issues', 'reviews'].every((k) => isInt(y[k]))), 'byYear fields are non-negative integers')
check(c.allTime === sum(by.map((y) => y.total)), `allTime ${c.allTime} ≠ Σ byYear ${sum(by.map((y) => y.total))}`)
const tot = c.totals ?? {}
for (const k of ['commits', 'pullRequests', 'issues', 'reviews']) {
  check(isInt(tot[k]) && tot[k] === sum(by.map((y) => y[k] ?? 0)), `totals.${k} ${tot[k]} ≠ Σ byYear ${sum(by.map((y) => y[k] ?? 0))}`)
}
if (isInt(u.totalCommits) && isInt(tot.commits)) warn(u.totalCommits >= tot.commits, `user.totalCommits ${u.totalCommits} < visible commit contributions ${tot.commits}`)
if (u.createdAt && by.length) check(by[0].year >= Number(u.createdAt.slice(0, 4)), 'byYear starts before the account existed')
if (today && by.length) check(by.at(-1).year === Number(today.slice(0, 4)), `byYear ends at ${by.at(-1)?.year}, calendar at ${today}`)

check(cal.length >= 365 && cal.length <= 371, `calendar has ${cal.length} days (expected 365–371)`)
check(cal.length && weekdayOf(cal[0].date) === 0, `calendar starts on ${cal[0] && WEEKDAYS[weekdayOf(cal[0].date)]}, not Sunday`)
check(today && cal.length === 364 + weekdayOf(today) + 1, `calendar length ${cal.length} ≠ 52 weeks + current partial week`)
check(cal.every((d, i) => isDate(d.date) && (i === 0 || d.date === addDays(cal[i - 1].date, 1))), 'calendar dates are not consecutive')
check(cal.every((d) => isInt(d.count) && Number.isInteger(d.level) && d.level >= 0 && d.level <= 4), 'calendar count/level out of range')
check(cal.every((d) => (d.count === 0) === (d.level === 0)), 'calendar level 0 must match count 0')
const calSum = sum(cal.map((d) => d.count))
warn(calSum === c.lastYear, `Σ calendar ${calSum} ≠ lastYear ${c.lastYear} (rolling window differs from the 53-week grid)`)

const mon = Array.isArray(c.monthly) ? c.monthly : []
check(mon.length === 12, `monthly has ${mon.length} entries`)
check(today && mon.at(-1)?.month === today.slice(0, 7), `monthly ends at ${mon.at(-1)?.month}, not the current month`)
check(mon.every((x, i) => /^\d{4}-\d{2}$/.test(x.month) && isInt(x.total) && (i === 0 || x.month > mon[i - 1].month)), 'monthly entries malformed/unsorted')
check(mon.every((x, i) => x.partial === (i === mon.length - 1)), 'monthly[].partial must be true for the current month only')
for (const x of mon) {
  const days = cal.filter((d) => d.date.startsWith(x.month))
  const fullyInside = days.length && days[0].date.endsWith('-01')
  if (fullyInside) check(sum(days.map((d) => d.count)) === x.total, `monthly ${x.month} ${x.total} ≠ Σ calendar ${sum(days.map((d) => d.count))}`)
}

const wd = Array.isArray(c.weekday) ? c.weekday : []
check(wd.length === 7 && wd.every((v) => isInt(v)), 'weekday must be 7 non-negative integers')
check(sum(wd) === c.lastYear, `Σ weekday ${sum(wd)} ≠ lastYear ${c.lastYear}`)
const calWd = [0, 0, 0, 0, 0, 0, 0]
for (const d of cal) calWd[weekdayOf(d.date)] += d.count
warn(calWd.every((v, i) => v === wd[i]), 'weekday differs from the calendar grid (rolling window ≠ grid)')
check(wd.some((v) => v > 0) ? c.busiestWeekday === wd.indexOf(Math.max(...wd)) : c.busiestWeekday === null, `busiestWeekday ${c.busiestWeekday} ≠ argmax`)

const cs = c.currentStreak ?? {}
check(isInt(cs.days), 'currentStreak.days')
if (cs.days > 0) {
  check(isDate(cs.start) && isDate(cs.end), 'currentStreak start/end dates')
  check(cs.end === today || cs.end === addDays(today, -1), `currentStreak ends ${cs.end}, not today/yesterday`)
  if (cs.end !== today) check(countOf(today) === 0, 'currentStreak ends yesterday but today has contributions')
  check(daysBetween(cs.start, cs.end) + 1 === cs.days, 'currentStreak span ≠ days')
  check(cal.filter((d) => d.date >= cs.start && d.date <= cs.end).every((d) => d.count > 0), 'currentStreak covers a 0-day')
  if (byDate.has(addDays(cs.start, -1))) check(countOf(addDays(cs.start, -1)) === 0, 'currentStreak could extend further back')
} else {
  check(cs.start === null && cs.end === null, 'empty currentStreak must have null start/end')
  check(countOf(today) === 0 && countOf(addDays(today, -1)) === 0, 'currentStreak is 0 but today/yesterday has contributions')
}
const ls = c.longestStreak ?? {}
check(isInt(ls.days) && ls.days >= (cs.days ?? 0), `longestStreak ${ls.days} < currentStreak ${cs.days}`)
if (ls.days > 0) {
  check(daysBetween(ls.start, ls.end) + 1 === ls.days, 'longestStreak span ≠ days')
  check(cal.filter((d) => d.date >= ls.start && d.date <= ls.end).every((d) => d.count > 0), 'longestStreak covers a 0-day')
}

// Weekly streaks (all years) — what the 53-week grid can confirm.
const calWeeks = new Map() // Sunday → Σ count, weeks fully or partly in the grid
for (const d of cal) calWeeks.set(weekStartOf(d.date), (calWeeks.get(weekStartOf(d.date)) ?? 0) + d.count)
const thisWeek = today ? weekStartOf(today) : null
check(isInt(c.activeWeeks) && c.activeWeeks === [...calWeeks.values()].filter((v) => v > 0).length,
  `activeWeeks ${c.activeWeeks} ≠ active grid weeks ${[...calWeeks.values()].filter((v) => v > 0).length}`)
const ws = c.weeklyStreak ?? {}
const wsShape = (x, name) => {
  check(x && isInt(x.weeks), `weeklyStreak.${name}.weeks`)
  if (!x || !isInt(x.weeks)) return false
  if (x.weeks === 0) {
    check(x.start === null && x.end === null, `empty weeklyStreak.${name} must have null start/end`)
    return false
  }
  check(isDate(x.start) && weekdayOf(x.start) === 0, `weeklyStreak.${name}.start ${x.start} is not a Sunday`)
  check(isDate(x.end) && (weekdayOf(x.end) === 6 || x.end === today) && x.end <= today, `weeklyStreak.${name}.end ${x.end} is not a Saturday/today`)
  check(daysBetween(x.start, weekStartOf(x.end)) / 7 + 1 === x.weeks, `weeklyStreak.${name} span ≠ ${x.weeks} weeks`)
  const inGrid = [...calWeeks.entries()].filter(([w]) => w >= x.start && w <= x.end)
  check(inGrid.every(([, v]) => v > 0), `weeklyStreak.${name} covers a week with 0 contributions`)
  return true
}
// A cache written before weeklyStreak existed cannot derive it (needs every year's days).
const hasWs = c.weeklyStreak !== undefined
warn(hasWs, 'contributions.weeklyStreak is missing (cached data from before it existed)')
if (hasWs && wsShape(ws.current, 'current')) {
  const ongoing = weekStartOf(ws.current.end) === thisWeek
  check(ongoing || ws.current.end === addDays(thisWeek, -1), `weeklyStreak.current ends ${ws.current.end}, not this or last week`)
  if (!ongoing) check((calWeeks.get(thisWeek) ?? 0) === 0, 'weeklyStreak.current skips an active current week')
  const before = addDays(ws.current.start, -7)
  if (calWeeks.has(before) && before >= cal[0].date) check(calWeeks.get(before) === 0, 'weeklyStreak.current could extend further back')
  check(ws.current.weeks >= Math.ceil((cs.days ?? 0) / 7), `weeklyStreak.current ${ws.current.weeks} weeks < daily streak ${cs.days} days`)
} else if (hasWs && ws.current?.weeks === 0 && thisWeek) {
  check((calWeeks.get(thisWeek) ?? 0) === 0 && (calWeeks.get(addDays(thisWeek, -7)) ?? 0) === 0, 'weeklyStreak.current is 0 but this/last week is active')
}
if (hasWs && wsShape(ws.longest, 'longest')) {
  check(ws.longest.weeks >= (ws.current?.weeks ?? 0), `weeklyStreak.longest ${ws.longest.weeks} < current ${ws.current?.weeks}`)
  check(ws.longest.weeks >= Math.ceil((ls.days ?? 0) / 7), `weeklyStreak.longest ${ws.longest.weeks} weeks < longest daily streak ${ls.days} days`)
}

const maxDay = Math.max(0, ...cal.map((d) => d.count))
if (c.bestDay) {
  check(isDate(c.bestDay.date) && isInt(c.bestDay.count, 1), 'bestDay shape')
  if (byDate.has(c.bestDay.date)) check(countOf(c.bestDay.date) === c.bestDay.count && c.bestDay.count === maxDay, `bestDay ${c.bestDay.count} ≠ calendar max ${maxDay}`)
} else check(maxDay === 0, 'bestDay is null but the calendar has contributions')
const active = cal.filter((d) => d.count > 0).length
check(isInt(c.activeDays) && c.activeDays <= cal.length, `activeDays ${c.activeDays}`)
warn(c.activeDays === active, `activeDays ${c.activeDays} ≠ active calendar days ${active}`)
check(near(c.dailyAverage, c.lastYear / (c.windowDays || cal.length), 0.051), `dailyAverage ${c.dailyAverage} ≠ lastYear / windowDays`)

// ── PRs, issues, repos, languages ───────────────────────────────────────────
const pr = m.pullRequests ?? {}
check(isInt(pr.total) && isInt(pr.merged) && isInt(pr.open), 'pullRequests counts')
check(pr.merged + pr.open <= pr.total, 'merged + open > total PRs')
check(pr.total ? near(pr.mergeRate, pr.merged / pr.total, 1e-3) : pr.mergeRate === null, `mergeRate ${pr.mergeRate}`)
check(isInt(m.issues?.total), 'issues.total')
check(isInt(m.repositoriesContributedTo), 'repositoriesContributedTo')

const langs = Array.isArray(m.languages) ? m.languages : []
check(langs.length > 0 && langs.length <= 9, `languages has ${langs.length} entries (1–9)`)
check(langs.every((l) => typeof l.name === 'string' && /^#[0-9a-f]{6}$/i.test(l.color) && isInt(l.bytes, 1) && isNum(l.share) && l.share >= 0 && l.share <= 1), 'languages entries malformed')
check(new Set(langs.map((l) => l.name)).size === langs.length, 'duplicate language names')
const ranked = langs.filter((l) => l.name !== 'Other')
check(ranked.every((l, i) => i === 0 || l.bytes <= ranked[i - 1].bytes), 'languages not sorted by bytes')
check(!langs.some((l) => l.name === 'Other') || langs.at(-1).name === 'Other', '"Other" must be last')
check(near(sum(langs.map((l) => l.share)), 1, 0.003), `language shares sum to ${sum(langs.map((l) => l.share)).toFixed(4)}`)

// ── wakatime ────────────────────────────────────────────────────────────────
const w = m.wakatime ?? {}
check(isInt(w.allTime?.totalSeconds) && /^[\d,]+ hrs$/.test(w.allTime?.text ?? ''), 'wakatime.allTime totalSeconds/text')
check(w.allTime?.since === null || isDate(w.allTime?.since), 'wakatime.allTime.since')
const ly = w.lastYear ?? {}
const RANGES = ['last_year', 'last_30_days', 'last_7_days']
check(RANGES.includes(ly.range), `wakatime.lastYear.range = ${ly.range}`)
if (ly.range === 'last_year') check(isInt(ly.totalSeconds), 'wakatime.lastYear.totalSeconds (last_year) must be an integer')
else check(ly.totalSeconds === null, `wakatime.lastYear.totalSeconds must be null for range ${ly.range} (not a yearly total)`)
check(isInt(ly.dailyAverageSeconds) && ly.dailyAverageSeconds <= 86_400, 'wakatime.lastYear.dailyAverageSeconds')
if (isInt(ly.totalSeconds)) check(ly.totalSeconds <= (w.allTime?.totalSeconds ?? Infinity), 'wakatime lastYear > allTime')
if (src.wakatime === 'seed') check(ly.range === 'last_year', 'seeded wakatime must be a last_year block')
for (const k of ['languages', 'editors', 'operatingSystems']) {
  const list = Array.isArray(ly[k]) ? ly[k] : []
  check(list.length > 0 && list.every((x) => typeof x.name === 'string' && isNum(x.percent) && x.percent >= 0 && x.percent <= 100), `wakatime.lastYear.${k} malformed`)
  check(sum(list.map((x) => x.percent)) <= 100.5, `wakatime.lastYear.${k} percents exceed 100`)
  check(list.every((x, i) => i === 0 || x.percent <= list[i - 1].percent), `wakatime.lastYear.${k} not sorted`)
}
check((ly.languages ?? []).every((x) => isInt(x.totalSeconds)), 'wakatime languages totalSeconds')
check(ly.bestDay === null || (isDate(ly.bestDay?.date) && isInt(ly.bestDay?.totalSeconds)), 'wakatime.lastYear.bestDay')

// ── summary ─────────────────────────────────────────────────────────────────
const hrs = (s) => (isNum(s) ? `${fmt.format(Math.round(s / 3600))} h` : '—')
const dur = (s) => (isNum(s) ? `${Math.floor(s / 3600)}h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}m` : '—')
const pct = (r) => (isNum(r) ? `${(r * 100).toFixed(1)}%` : '—')
const line = (k, v) => console.log(`  ${k.padEnd(22)} ${v}`)
console.log(`\nmetrics.json · generated ${m.generatedAt}`)
line('sources', `github: ${src.github} (${src.githubAt ?? 'never live'}) · wakatime: ${src.wakatime} (${src.wakatimeAt ?? 'never live'})`)
console.log('\nGitHub')
line('user', `${u.login} (${u.name}) · joined ${u.createdAt?.slice(0, 10)} · ${u.yearsOnGitHub} years`)
line('commits authored', `${n(u.totalCommits)} (search/commits, all time)`)
line('repositories', `${n(u.totalRepos)} total · ${n(u.publicRepos)} public · ${n(u.privateRepos)} private · ${n(u.stars)} stars`)
line('people', `${n(u.followers)} followers · ${n(u.following)} following · contributed to ${n(m.repositoriesContributedTo)} repos`)
line('pull requests', `${n(pr.total)} total · ${n(pr.merged)} merged · ${n(pr.open)} open · ${pct(pr.mergeRate)} merge rate`)
line('issues', n(m.issues?.total))
console.log('\nContributions')
line('all time', `${n(c.allTime)} (${by.map((y) => `${y.year}: ${n(y.total)}`).join(' · ')})`)
line('totals (visible)', `${n(tot.commits)} commits · ${n(tot.pullRequests)} PRs · ${n(tot.issues)} issues · ${n(tot.reviews)} reviews`)
line('last year', `${n(c.lastYear)} vs ${n(c.previousYear)} the year before (${c.yoyGrowth === null ? '—' : `${c.yoyGrowth >= 0 ? '+' : ''}${(c.yoyGrowth * 100).toFixed(0)}%`})`)
line('window', `${n(c.windowDays)} days · ${c.timezone ?? '—'} · ${n(c.activeWeeks)} active weeks of ${calWeeks.size}`)
line('calendar', `${cal.length} days · ${cal[0]?.date} (${WEEKDAYS[weekdayOf(cal[0]?.date ?? '1970-01-04')]}) → ${today} (${today ? WEEKDAYS[weekdayOf(today)] : '—'}) · today ${n(countOf(today))}`)
line('current streak', cs.days ? `${cs.days} days (${cs.start} → ${cs.end})` : '0 days')
line('longest streak', ls.days ? `${ls.days} days (${ls.start} → ${ls.end})` : '0 days')
const wkLine = (x) => (x?.weeks ? `${x.weeks} weeks (${x.start} → ${x.end})` : '0 weeks')
line('weekly streak', hasWs ? `${wkLine(ws.current)} · longest ${wkLine(ws.longest)}` : '—')
line('best day', c.bestDay ? `${n(c.bestDay.count)} on ${c.bestDay.date}` : '—')
line('active days', `${n(c.activeDays)} · ${n(c.dailyAverage)} per day on average`)
line('busiest weekday', `${WEEKDAYS[c.busiestWeekday] ?? '—'} · ${wd.map((v, i) => `${WEEKDAYS[i]} ${n(v)}`).join(' · ')}`)
line('monthly', mon.map((x) => `${x.month.slice(2)} ${n(x.total)}${x.partial ? '*' : ''}`).join(' · ') + '  (* partial)')
line('languages', langs.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(' · '))
console.log('\nWakaTime')
line('all time', `${w.allTime?.text ?? '—'}${w.allTime?.since ? ` since ${w.allTime.since}` : ''}`)
line('stats range', ly.range ?? '—')
line('last year', `${hrs(ly.totalSeconds)} · ${dur(ly.dailyAverageSeconds)} daily average`)
line('languages', (ly.languages ?? []).map((x) => `${x.name} ${x.percent}%`).join(' · '))
line('editor · OS', `${ly.editors?.[0]?.name ?? '—'} · ${ly.operatingSystems?.[0]?.name ?? '—'}`)

console.log(`\n${passed} checks passed · ${warnings.length} warning(s) · ${errors.length} error(s)`)
if (warnings.length) console.warn(warnings.map((x) => `⚠ ${x}`).join('\n'))
if (errors.length) {
  console.error(errors.map((x) => `✗ ${x}`).join('\n'))
  process.exit(1)
}
console.log('✓ metrics model matches DESIGN.md §6')
