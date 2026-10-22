// Tiny HTTP layer shared by the collectors: timeouts, retry with exponential
// backoff on transient failures (network errors, 5xx, 429, GitHub's secondary
// rate limit) and consistent, prefixed logging. Zero dependencies (Node ≥ 20).

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function logger(scope) {
  const tag = `[${scope}]`
  return {
    info: (...args) => console.log(tag, ...args),
    warn: (...args) => console.warn(`${tag} ⚠`, ...args),
    error: (...args) => console.error(`${tag} ✗`, ...args),
  }
}

export class HttpError extends Error {
  constructor(message, { status = 0, body = null, headers = null } = {}) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
    this.headers = headers
  }
}

function retryDelay(res, attempt, base) {
  const retryAfter = Number(res?.headers?.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 60_000)
  const reset = Number(res?.headers?.get('x-ratelimit-reset'))
  if (res?.headers?.get('x-ratelimit-remaining') === '0' && Number.isFinite(reset)) {
    const wait = reset * 1000 - Date.now()
    if (wait > 0 && wait <= 60_000) return wait
  }
  return Math.min(base * 2 ** attempt, 30_000)
}

function isSecondaryRateLimit(status, text) {
  return (status === 403 || status === 429) && /secondary rate limit|abuse|rate limit/i.test(text || '')
}

// fetch → { status, headers, text, json }. Throws HttpError when the request
// still fails after `retries` retries or returns a non-retryable error status.
// `accept` lists extra statuses returned to the caller instead of thrown (e.g. 202).
export async function request(url, {
  method = 'GET',
  headers = {},
  body,
  timeout = 30_000,
  retries = 3,
  backoff = 1_000,
  accept = [],
  label = url,
  log = logger('http'),
} = {}) {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let res = null
    try {
      res = await fetch(url, {
        method,
        headers: { 'user-agent': 'runyshark-profile-generator', ...headers },
        body,
        signal: AbortSignal.timeout(timeout),
      })
      const text = await res.text()
      let json = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      if (res.ok || accept.includes(res.status)) {
        return { status: res.status, headers: res.headers, text, json }
      }
      const retryable = res.status >= 500 || res.status === 429 || isSecondaryRateLimit(res.status, text)
      const snippet = (json?.message || text || '').toString().replace(/\s+/g, ' ').slice(0, 160)
      lastError = new HttpError(`${label}: HTTP ${res.status}${snippet ? ` — ${snippet}` : ''}`, {
        status: res.status,
        body: json ?? text,
        headers: res.headers,
      })
      if (!retryable) {
        lastError.fatal = true
        throw lastError
      }
    } catch (err) {
      if (err?.fatal) throw err
      // network failure, DNS, reset, AbortSignal timeout → retryable
      const cause = err?.cause?.code || err?.cause?.message
      const reason = err?.name === 'TimeoutError'
        ? `timed out after ${timeout} ms`
        : `${err?.message || String(err)}${cause ? ` (${cause})` : ''}`
      lastError = new HttpError(`${label}: ${reason}`)
    }
    if (attempt < retries) {
      const wait = retryDelay(res, attempt, backoff)
      log.warn(`${lastError.message} — retry ${attempt + 1}/${retries} in ${(wait / 1000).toFixed(1)}s`)
      await sleep(wait)
    }
  }
  throw lastError
}
