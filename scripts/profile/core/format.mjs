// Number, duration and date formatting shared by every metric component.

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const intFmt = new Intl.NumberFormat('en-US')

// 44771 → "44.8K"; values under 10k stay exact ("1,755").
export function compact(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Math.abs(n) < 10_000 ? intFmt.format(Math.round(n)) : compactFmt.format(n)
}

export function int(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return intFmt.format(Math.round(n))
}

// 0.9601 → "96%"; 1.29 → "+129%" with { signed: true }.
export function percent(ratio, { signed = false, digits = 0 } = {}) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—'
  const value = (ratio * 100).toFixed(digits)
  return signed && ratio > 0 ? `+${value}%` : `${value}%`
}

// 9_150_000 s → "2,541 h"
export function hours(seconds) {
  if (!seconds && seconds !== 0) return '—'
  return `${intFmt.format(Math.round(seconds / 3600))} h`
}

// 26160 s → "7h 16m"
export function duration(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// '2026-10-21' → 'Oct 21, 2026' (UTC, no locale surprises in CI)
export function date(iso, { year = true } = {}) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return year ? `${base}, ${d.getUTCFullYear()}` : base
}

// '2026-10' → 'Oct'
export function monthLabel(isoMonth) {
  return MONTHS[Number(String(isoMonth).slice(5, 7)) - 1]
}

// ── Copy & time helpers for the shared panel system (DESIGN.md §2.1) ─────
// Additive only: everything above keeps its signature and behaviour.

// U+2212 MINUS SIGN: negatives on screen never use the ASCII hyphen.
export const MINUS = '−'

// plural(1, 'day') → 'day'; plural(2, 'day') → 'days';
// plural(3, 'repository', 'repositories') → 'repositories'. Returns the word only.
export function plural(n, one, many = `${one}s`) {
  return Math.abs(Number(n)) === 1 ? one : many
}

// quantity(1, 'day') → '1 day'; quantity(1234.4, 'contribution') → '1,234 contributions'.
// The noun follows the *rounded* number, so 1.2 reads "1 day". '—' when missing.
export function quantity(n, one, many = `${one}s`) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const rounded = Math.round(n)
  return `${intFmt.format(rounded)} ${plural(rounded, one, many)}`
}

// Delta text from a ratio: 2.63 → '+263%', -0.12 → '−12%' (U+2212),
// 31.3 → '+3,130%'. null when the value is missing or rounds to 0 at `digits`,
// so the caller hides the chip instead of showing "+0%" / "−0%".
export function signedPercent(ratio, { digits = 0 } = {}) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return null
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const abs = fmt.format(Math.abs(ratio * 100))
  if (Number(abs.replace(/,/g, '')) === 0) return null
  return `${ratio > 0 ? '+' : MINUS}${abs}%`
}

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const zoneFormatters = new Map()

function zoneFormatter(tz) {
  if (!zoneFormatters.has(tz)) {
    let f
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
      })
    } catch {
      f = zoneFormatter('UTC') // unknown zone → UTC; never throw mid-render
    }
    zoneFormatters.set(tz, f)
  }
  return zoneFormatters.get(tz)
}

// Calendar parts of `iso` as seen in `tz`: { year, month (1–12), day, hour, minute, second }.
// A date-only string ('2026-10-21') already is a calendar day and is returned
// as-is (no zone shift); a timestamp is converted. null for missing/invalid input.
export function zonedParts(iso, tz = 'UTC') {
  if (iso === null || iso === undefined || iso === '') return null
  const s = String(iso).trim()
  const day = DAY_ONLY.exec(s)
  if (day) {
    const [year, month, d] = [Number(day[1]), Number(day[2]), Number(day[3])]
    if (month < 1 || month > 12 || d < 1 || d > 31) return null
    return { year, month, day: d, hour: 0, minute: 0, second: 0 }
  }
  const t = new Date(s)
  if (Number.isNaN(t.getTime())) return null
  const out = {}
  for (const p of zoneFormatter(tz || 'UTC').formatToParts(t)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24, minute: out.minute, second: out.second }
}

function partsLabel(p, year) {
  const base = `${MONTHS[p.month - 1]} ${p.day}`
  if (year === 'short') return `${base} ’${String(p.year).slice(-2)}`
  return year ? `${base}, ${p.year}` : base
}

// Human date in a time zone. en-US month names, assembled from Intl parts so the
// output is byte-stable across ICU versions:
//   dateInZone('2026-10-22T04:57:25Z', 'America/Mexico_City') → 'Oct 21, 2026'
//   { year: false } → 'Oct 21'      { year: 'short' } → 'Oct 21 ’26'
// Date-only input is a calendar day and is never shifted. Returns null (not '—')
// for missing/invalid input so the caller can drop the whole phrase.
export function dateInZone(iso, tz = 'UTC', { year = true } = {}) {
  const p = zonedParts(iso, tz)
  return p ? partsLabel(p, year) : null
}

// Compact range with an en dash:
//   same day   → 'Oct 21, 2026'
//   same year  → 'Mar 2 – Jul 30, 2025'
//   cross-year → 'Dec 31 ’23 – Feb 27 ’24'   ({ crossYear: 'full' } → 'Dec 31, 2023 – Feb 27, 2024')
// Reversed input is swapped; one missing end collapses to the known date;
// null when neither end parses.
export function dateRange(start, end, { tz = 'UTC', crossYear = 'short' } = {}) {
  let a = zonedParts(start, tz)
  let b = zonedParts(end, tz)
  if (!a && !b) return null
  if (!a || !b) return partsLabel(a ?? b, true)
  const key = (p) => p.year * 10000 + p.month * 100 + p.day
  if (key(a) > key(b)) [a, b] = [b, a]
  if (key(a) === key(b)) return partsLabel(a, true)
  if (a.year === b.year) return `${partsLabel(a, false)} – ${partsLabel(b, true)}`
  const y = crossYear === 'full' ? true : 'short'
  return `${partsLabel(a, y)} – ${partsLabel(b, y)}`
}

// UTC offset of `tz` at the instant `at` (DST-aware, so an instant is required):
//   utcOffset('America/Mexico_City', '2026-10-22T04:57:25Z') → 'UTC−6'
//   'Asia/Kolkata' → 'UTC+5:30', 'UTC' → 'UTC'. null when `at` is not a timestamp.
export function utcOffset(tz, at) {
  if (!at || DAY_ONLY.test(String(at).trim())) return null
  const t = new Date(String(at))
  if (Number.isNaN(t.getTime())) return null
  const p = zonedParts(t.toISOString(), tz)
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const minutes = Math.round((local - Math.floor(t.getTime() / 1000) * 1000) / 60000)
  if (minutes === 0) return 'UTC'
  const abs = Math.abs(minutes)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return `UTC${minutes > 0 ? '+' : MINUS}${hh}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`
}
