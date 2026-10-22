// Pure, deterministic contribution statistics. Input: GitHub calendar days
// (rolling window + one collection per contribution year). Output: the
// `contributions` block of the metrics model (DESIGN.md §6).
//
// Dates are 'YYYY-MM-DD' strings in the user's GitHub timezone (that is how the
// GraphQL calendar reports them); arithmetic runs on UTC midnights, so no local
// timezone or DST can shift a day.

const DAY = 86_400_000

export const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 }

export const toTime = (iso) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`)
export const toISO = (t) => new Date(t).toISOString().slice(0, 10)
export const addDays = (iso, n) => toISO(toTime(iso) + n * DAY)
export const weekdayOf = (iso) => new Date(toTime(iso)).getUTCDay()
export const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY)

export const round = (n, digits = 0) => {
  if (!Number.isFinite(n)) return null
  const f = 10 ** digits
  return Math.round(n * f) / f
}

// GitHub calendar day → { date, count, level } with level clamped to 0–4.
export function normalizeDay(day) {
  const count = Math.max(0, Number(day?.contributionCount ?? day?.count ?? 0) || 0)
  const raw = day?.contributionLevel ?? day?.level
  let level = typeof raw === 'number' ? raw : LEVELS[raw]
  if (!Number.isInteger(level)) level = count > 0 ? 1 : 0
  level = Math.min(4, Math.max(0, level))
  if (count === 0) level = 0
  return { date: String(day.date).slice(0, 10), count, level }
}

function streakEnding(map, end) {
  let start = end
  let days = 0
  for (let d = end; (map.get(d)?.count ?? 0) > 0; d = addDays(d, -1)) {
    start = d
    days += 1
  }
  return { days, start, end }
}

// Sunday that opens the GitHub calendar week containing `iso`.
export const weekStartOf = (iso) => addDays(iso, -weekdayOf(iso))

const noWeeks = () => ({ weeks: 0, start: null, end: null })

/**
 * Weekly streaks over every known day (Sunday-aligned weeks, as in GitHub's
 * calendar). A week is active when any of its days ≤ today has a contribution;
 * days missing from `map` count as 0.
 *
 *   current — ends at the ongoing week if it already has contributions,
 *             otherwise at the previous week ("nothing yet this week" must not
 *             break a streak that is still alive).
 *   longest — the longest run of active weeks (the earliest one on ties).
 *
 * `start` is the Sunday of the first week; `end` the Saturday of the last week,
 * capped at `today` for the ongoing week.
 *
 * @param {Map<string, { count:number }>} map  'YYYY-MM-DD' → day
 * @param {string} today                       last day of the data ('YYYY-MM-DD')
 * @returns {{ current: { weeks:number, start:string|null, end:string|null },
 *             longest: { weeks:number, start:string|null, end:string|null } }}
 */
export function weeklyStreaks(map, today) {
  if (!today || !map?.size) return { current: noWeeks(), longest: noWeeks() }
  let first = null
  const active = new Set()
  for (const [date, day] of map) {
    if (date > today) continue
    if (first === null || date < first) first = date
    if ((day?.count ?? 0) > 0) active.add(weekStartOf(date))
  }
  if (!active.size) return { current: noWeeks(), longest: noWeeks() }
  const thisWeek = weekStartOf(today)
  const span = (start, lastWeek, weeks) => {
    const sat = addDays(lastWeek, 6)
    return { weeks, start, end: sat < today ? sat : today }
  }

  let longest = noWeeks()
  let run = 0
  let runStart = null
  for (let w = weekStartOf(first); w <= thisWeek; w = addDays(w, 7)) {
    if (active.has(w)) {
      if (run === 0) runStart = w
      run += 1
      if (run > longest.weeks) longest = span(runStart, w, run)
    } else run = 0
  }

  const anchor = active.has(thisWeek) ? thisWeek : addDays(thisWeek, -7)
  let weeks = 0
  let start = null
  for (let w = anchor; active.has(w); w = addDays(w, -7)) {
    start = w
    weeks += 1
  }
  return { current: weeks ? span(start, anchor, weeks) : noWeeks(), longest }
}

// Σ of the per-year breakdown (what GitHub counts as visible, non-restricted
// contributions of each kind). Missing years → zeros; no years → nulls.
export function contributionTotals(byYear) {
  const keys = ['commits', 'pullRequests', 'issues', 'reviews']
  const list = Array.isArray(byYear) ? byYear : []
  const out = {}
  for (const k of keys) out[k] = list.length ? list.reduce((s, y) => s + (Number.isFinite(y?.[k]) ? y[k] : 0), 0) : null
  return out
}

// Weeks of a Sunday-aligned calendar with at least one contribution.
export function countActiveWeeks(calendar) {
  const weeks = new Set()
  for (const d of Array.isArray(calendar) ? calendar : []) {
    if ((d?.count ?? 0) > 0 && d.date) weeks.add(weekStartOf(d.date))
  }
  return weeks.size
}

/**
 * Fill the fields that can be derived from an existing `contributions` block
 * (e.g. a cache written before they existed): windowDays, timezone,
 * activeWeeks, totals, monthly[].partial. Never overwrites present values and
 * never invents what needs per-year day data (weeklyStreak). Pure.
 */
export function deriveContributions(c, { timezone = null } = {}) {
  if (!c || typeof c !== 'object') return c
  const out = { ...c }
  const calendar = Array.isArray(c.calendar) ? c.calendar : []
  const today = calendar.at(-1)?.date ?? null
  if (!Number.isInteger(out.windowDays) && calendar.length) out.windowDays = calendar.length
  if (typeof out.timezone !== 'string' && timezone) out.timezone = timezone
  if (!Number.isInteger(out.activeWeeks) && calendar.length) out.activeWeeks = countActiveWeeks(calendar)
  if (!out.totals && Array.isArray(c.byYear)) out.totals = contributionTotals(c.byYear)
  if (Array.isArray(c.monthly) && today && c.monthly.some((m) => typeof m?.partial !== 'boolean')) {
    out.monthly = c.monthly.map((m) => ({ ...m, partial: typeof m?.partial === 'boolean' ? m.partial : m?.month === today.slice(0, 7) }))
  }
  return out
}

/**
 * @param {object} input
 * @param {{ total:number, days:Array }} input.rolling   default contributionsCollection calendar
 * @param {Array<{ year:number, total:number, commits?:number, pullRequests?:number,
 *                 issues?:number, reviews?:number, days:Array }>} input.years
 * @param {string} [input.timezone]  IANA zone the GitHub calendar is reported in
 */
export function computeContributions({ rolling, years, timezone = null }) {
  const rollingDays = (rolling?.days ?? []).map(normalizeDay).sort((a, b) => a.date.localeCompare(b.date))
  if (!rollingDays.length) throw new Error('rolling contribution calendar is empty')
  const today = rollingDays.at(-1).date
  const windowStart = rollingDays[0].date

  // Every known day ≤ today. Rolling-window days win (their levels are the ones
  // GitHub shows on the profile); per-year days fill everything before it.
  const all = new Map()
  for (const y of years ?? []) {
    for (const raw of y.days ?? []) {
      const d = normalizeDay(raw)
      if (d.date <= today) all.set(d.date, d)
    }
  }
  for (const d of rollingDays) all.set(d.date, d)
  const sortedDates = [...all.keys()].sort()
  const firstDate = sortedDates[0]

  // byYear / allTime
  const byYear = (years ?? [])
    .map((y) => ({
      year: y.year,
      total: y.total ?? 0,
      commits: y.commits ?? 0,
      pullRequests: y.pullRequests ?? 0,
      issues: y.issues ?? 0,
      reviews: y.reviews ?? 0,
    }))
    .sort((a, b) => a.year - b.year)
  const allTime = byYear.length ? byYear.reduce((s, y) => s + y.total, 0) : null

  // Rolling window figures
  const lastYear = Number.isFinite(rolling?.total) ? rolling.total : rollingDays.reduce((s, d) => s + d.count, 0)
  const windowLength = rollingDays.length
  // The comparison window has the same length as GitHub's "last year" (365–371
  // days, Sunday-aligned), so the YoY ratio is not biased by a few extra days.
  let previousYear = 0
  for (let i = 1; i <= windowLength; i += 1) previousYear += all.get(addDays(windowStart, -i))?.count ?? 0
  // Without per-year data the days before the window are unknown, not zero.
  if (!byYear.length) previousYear = null
  const yoyGrowth = previousYear > 0 ? round(lastYear / previousYear - 1, 4) : null

  // Sunday-aligned 53-week calendar ending today (current week may be partial).
  const calendarStart = addDays(today, -(52 * 7 + weekdayOf(today)))
  const calendar = []
  for (let d = calendarStart; d <= today; d = addDays(d, 1)) {
    const day = all.get(d)
    calendar.push({ date: d, count: day?.count ?? 0, level: day?.level ?? 0 })
  }

  // Last 12 calendar months including the current (partial) one.
  const [ty, tm] = today.split('-').map(Number)
  const monthly = []
  for (let i = 11; i >= 0; i -= 1) {
    const idx = ty * 12 + (tm - 1) - i
    const month = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
    // The last entry is the current month, still in progress (today included).
    monthly.push({ month, total: 0, partial: i === 0 })
  }
  const monthIndex = new Map(monthly.map((m, i) => [m.month, i]))
  for (const [date, d] of all) {
    const i = monthIndex.get(date.slice(0, 7))
    if (i !== undefined) monthly[i].total += d.count
  }

  // Weekday distribution, best day and active days over the rolling window.
  const weekday = [0, 0, 0, 0, 0, 0, 0]
  let bestDay = null
  let activeDays = 0
  for (const d of rollingDays) {
    weekday[weekdayOf(d.date)] += d.count
    if (d.count > 0) activeDays += 1
    if (d.count > 0 && (!bestDay || d.count > bestDay.count)) bestDay = { date: d.date, count: d.count }
  }
  const busiestWeekday = weekday.some((n) => n > 0) ? weekday.indexOf(Math.max(...weekday)) : null

  // Current streak: alive while today or yesterday has contributions — "today
  // has 0 so far" must not break a streak that ended yesterday.
  const anchor = (all.get(today)?.count ?? 0) > 0 ? today : addDays(today, -1)
  const cur = streakEnding(all, anchor)
  const currentStreak = cur.days > 0 ? cur : { days: 0, start: null, end: null }

  // Longest streak over every known day (gaps in the data count as 0).
  let longest = { days: 0, start: null, end: null }
  if (firstDate) {
    let run = 0
    let runStart = null
    for (let d = firstDate; d <= today; d = addDays(d, 1)) {
      if ((all.get(d)?.count ?? 0) > 0) {
        if (run === 0) runStart = d
        run += 1
        if (run > longest.days) longest = { days: run, start: runStart, end: d }
      } else run = 0
    }
  }

  // Weekly streaks across every year; active weeks inside the 53-week grid.
  const weeklyStreak = weeklyStreaks(all, today)
  const activeWeeks = countActiveWeeks(calendar)

  return {
    allTime,
    lastYear,
    previousYear,
    yoyGrowth,
    windowDays: calendar.length,
    timezone: timezone || null,
    totals: contributionTotals(byYear),
    byYear,
    calendar,
    monthly,
    weekday,
    busiestWeekday,
    currentStreak,
    longestStreak: longest,
    weeklyStreak,
    bestDay,
    activeDays,
    activeWeeks,
    dailyAverage: round(lastYear / windowLength, 1),
  }
}
