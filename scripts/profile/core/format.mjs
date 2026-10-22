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
