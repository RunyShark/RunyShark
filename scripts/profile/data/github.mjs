// GitHub collector: GraphQL v4 (+ REST for token scopes and the commit search)
// → the GitHub part of the metrics model (DESIGN.md §6): user, contributions,
// pullRequests, issues, repositoriesContributedTo, languages.
//
// user.totalCommits comes from GET /search/commits?q=author:<login> (total_count,
// commits authored all-time across every repository the token can see). It is
// best effort: on failure collect.mjs keeps the cached value.
//
// Visibility: private repositories, PRs and issues are only counted when the
// token belongs to the profile owner AND carries the classic `repo` scope. With
// anything less the collector still works (public data), reports
// `visibility !== 'full'`, and collect.mjs keeps the higher cached counts.

import { logger, request } from './http.mjs'
import { computeContributions, contributionTotals, round } from './stats.mjs'

const GRAPHQL = 'https://api.github.com/graphql'
const REST_USER = 'https://api.github.com/user'
const REST_SEARCH_COMMITS = 'https://api.github.com/search/commits'
const OTHER_COLOR = '#878787'
const TOP_LANGUAGES = 8

const log = logger('github')

function headers(token) {
  return { authorization: `bearer ${token}`, accept: 'application/vnd.github+json' }
}

async function graphql(token, query, variables, label) {
  const res = await request(GRAPHQL, {
    method: 'POST',
    headers: { ...headers(token), 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    timeout: 45_000,
    retries: 3,
    backoff: 2_000,
    label: `graphql ${label}`,
    log,
  })
  const errors = res.json?.errors
  if (errors?.length) {
    const msg = errors.map((e) => e.message).join('; ').slice(0, 300)
    // Partial data with errors is not trustworthy for counts: fail the call.
    throw new Error(`graphql ${label}: ${msg}`)
  }
  if (!res.json?.data) throw new Error(`graphql ${label}: empty response`)
  return res.json.data
}

// Who is the token, and what can it see?
async function inspectToken(token, login) {
  let scopes = null
  let tokenLogin = null
  try {
    const res = await request(REST_USER, { headers: headers(token), timeout: 15_000, retries: 2, label: 'GET /user', log })
    tokenLogin = res.json?.login ?? null
    const header = res.headers.get('x-oauth-scopes')
    scopes = header === null ? null : header.split(',').map((s) => s.trim()).filter(Boolean)
    const remaining = res.headers.get('x-ratelimit-remaining')
    log.info(
      `token: ${tokenLogin ?? 'unknown user'} · scopes: ${scopes === null ? 'n/a (fine-grained or app token)' : scopes.join(', ') || 'none'}` +
        (remaining ? ` · REST rate limit remaining ${remaining}` : ''),
    )
  } catch (err) {
    if (err.status === 401) throw new Error(`token rejected by GitHub (401): ${err.message}`)
    log.warn(`could not inspect token (${err.message}) — scopes unknown`)
  }
  if (!tokenLogin) {
    try {
      tokenLogin = (await graphql(token, 'query { viewer { login } }', {}, 'viewer'))?.viewer?.login ?? null
    } catch (err) {
      log.warn(`viewer lookup failed (${err.message}) — falling back to public user() data`)
    }
  }
  const asViewer = Boolean(tokenLogin) && tokenLogin.toLowerCase() === login.toLowerCase()
  const visibility = !asViewer ? 'public' : scopes === null ? 'unknown' : scopes.includes('repo') ? 'full' : 'public'
  if (!asViewer) {
    log.warn(`token belongs to ${tokenLogin ?? 'an unknown account'}, not ${login}: using user(login) — public data only`)
  } else if (visibility === 'public') {
    log.warn("token has no 'repo' scope: private repositories, PRs and issues are invisible — counts may be lower than reality")
  } else if (visibility === 'unknown') {
    log.warn("token scopes unknown (no X-OAuth-Scopes header): private counts may be incomplete")
  }
  return { scopes, tokenLogin, asViewer, visibility }
}

const PROFILE_FIELDS = `
  login name createdAt
  followers { totalCount }
  following { totalCount }
  allRepos: repositories(ownerAffiliations: OWNER) { totalCount }
  publicRepos: repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
  privateRepos: repositories(ownerAffiliations: OWNER, privacy: PRIVATE) { totalCount }
  pullRequests { totalCount }
  mergedPullRequests: pullRequests(states: MERGED) { totalCount }
  openPullRequests: pullRequests(states: OPEN) { totalCount }
  issues { totalCount }
  repositoriesContributedTo(contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
  contributionsCollection {
    startedAt endedAt contributionYears
    contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
  }`

const YEAR_FIELDS = `
  totalCommitContributions totalPullRequestContributions totalIssueContributions
  totalPullRequestReviewContributions restrictedContributionsCount
  contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }`

const REPO_FIELDS = `
  repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $after, orderBy: { field: NAME, direction: ASC }) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes {
      stargazerCount
      languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
    }
  }`

// The same selection works for `viewer` and `user(login:)`; only the root differs.
function rooted(asViewer, fields, params = '') {
  const vars = [asViewer ? '' : '$login: String!', params].filter(Boolean).join(', ')
  const root = asViewer ? 'owner: viewer' : 'owner: user(login: $login)'
  return `query${vars ? `(${vars})` : ''} { ${root} { ${fields} } }`
}

const flattenDays = (calendar) => (calendar?.weeks ?? []).flatMap((w) => w.contributionDays ?? [])

async function fetchYears(token, ctx, years) {
  const out = []
  for (const year of [...years].sort((a, b) => a - b)) {
    const query = rooted(ctx.asViewer, `contributionsCollection(from: $from, to: $to) { ${YEAR_FIELDS} }`, '$from: DateTime!, $to: DateTime!')
    const data = await graphql(token, query, { ...ctx.vars, from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` }, `contributions ${year}`)
    const c = data.owner?.contributionsCollection
    if (!c?.contributionCalendar) throw new Error(`contributions ${year}: missing calendar`)
    out.push({
      year,
      total: c.contributionCalendar.totalContributions ?? 0,
      commits: c.totalCommitContributions ?? 0,
      pullRequests: c.totalPullRequestContributions ?? 0,
      issues: c.totalIssueContributions ?? 0,
      reviews: c.totalPullRequestReviewContributions ?? 0,
      restricted: c.restrictedContributionsCount ?? 0,
      days: flattenDays(c.contributionCalendar),
    })
    log.info(`  ${year}: ${out.at(-1).total.toLocaleString('en-US')} contributions (${out.at(-1).restricted.toLocaleString('en-US')} private/restricted)`)
  }
  return out
}

async function fetchRepositories(token, ctx) {
  const totals = new Map() // name → { bytes, color }
  let stars = 0
  let count = 0
  let after = null
  for (let page = 1; page <= 20; page += 1) {
    const data = await graphql(token, rooted(ctx.asViewer, REPO_FIELDS, '$after: String'), { ...ctx.vars, after }, `repositories p${page}`)
    const repos = data.owner?.repositories
    if (!repos) throw new Error('repositories: missing connection')
    for (const repo of repos.nodes ?? []) {
      if (!repo) continue
      count += 1
      stars += repo.stargazerCount ?? 0
      for (const edge of repo.languages?.edges ?? []) {
        const name = edge?.node?.name
        if (!name || !(edge.size > 0)) continue
        const entry = totals.get(name) ?? { bytes: 0, color: edge.node.color || OTHER_COLOR }
        entry.bytes += edge.size
        totals.set(name, entry)
      }
    }
    if (!repos.pageInfo?.hasNextPage) break
    after = repos.pageInfo.endCursor
  }
  const ranked = [...totals.entries()]
    .map(([name, v]) => ({ name, color: v.color, bytes: v.bytes }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
  const totalBytes = ranked.reduce((s, l) => s + l.bytes, 0)
  const top = ranked.slice(0, TOP_LANGUAGES)
  const restBytes = ranked.slice(TOP_LANGUAGES).reduce((s, l) => s + l.bytes, 0)
  if (restBytes > 0) top.push({ name: 'Other', color: OTHER_COLOR, bytes: restBytes })
  const languages = totalBytes ? top.map((l) => ({ ...l, share: round(l.bytes / totalBytes, 4) })) : []
  log.info(`  ${count} owned non-fork repositories · ${ranked.length} languages · ${stars} stars`)
  return { languages, stars }
}

// Commits authored all-time (REST commit search). Returns null when unavailable.
async function fetchTotalCommits(token, login) {
  const url = `${REST_SEARCH_COMMITS}?q=${encodeURIComponent(`author:${login}`)}&per_page=1`
  const res = await request(url, {
    headers: headers(token),
    timeout: 30_000,
    retries: 2,
    backoff: 2_000,
    label: 'GET /search/commits',
    log,
  })
  const total = res.json?.total_count
  if (!Number.isInteger(total) || total < 0) throw new Error('search/commits: no total_count in the response')
  const incomplete = res.json?.incomplete_results === true
  log.info(`  ${total.toLocaleString('en-US')} commits authored (search/commits${incomplete ? ', incomplete results' : ''})`)
  return { total, incomplete }
}

/**
 * @returns {Promise<{ part: object, visibility: 'full'|'unknown'|'public', partial: string[] }>}
 *   `part` holds the model's GitHub keys; `partial` lists keys that could not be
 *   fetched (collect.mjs fills them from the cache): 'languages', 'stars',
 *   'totalCommits'.
 */
export async function fetchGitHub({ token, login = 'RunyShark', now = new Date(), timezone = null }) {
  if (!token) throw new Error('no GITHUB_TOKEN')
  const started = Date.now()
  const auth = await inspectToken(token, login)
  const ctx = { asViewer: auth.asViewer, vars: auth.asViewer ? {} : { login } }

  const profile = (await graphql(token, rooted(ctx.asViewer, PROFILE_FIELDS), ctx.vars, 'profile')).owner
  if (!profile) throw new Error(`user ${login} not found`)
  const rollingCal = profile.contributionsCollection?.contributionCalendar
  const rollingDays = flattenDays(rollingCal)
  if (rollingDays.length < 365) throw new Error(`rolling calendar has only ${rollingDays.length} days`)
  const contributionYears = profile.contributionsCollection.contributionYears ?? []
  log.info(
    `${auth.asViewer ? 'viewer' : 'user'} ${profile.login}: ${profile.allRepos.totalCount} repos, ` +
      `${rollingCal.totalContributions.toLocaleString('en-US')} contributions in the rolling year, years ${contributionYears.join(', ')}`,
  )

  const years = await fetchYears(token, ctx, contributionYears)
  const contributions = computeContributions({
    rolling: { total: rollingCal.totalContributions, days: rollingDays },
    years,
    timezone,
  })
  const ws = contributions.weeklyStreak
  log.info(
    `  weekly streak: ${ws.current.weeks} weeks${ws.current.start ? ` (${ws.current.start} → ${ws.current.end})` : ''} · ` +
      `longest ${ws.longest.weeks} · ${contributions.activeWeeks} active weeks in the ${contributions.windowDays}-day window`,
  )

  const partial = []
  let repoStats = null
  try {
    repoStats = await fetchRepositories(token, ctx)
  } catch (err) {
    log.warn(`languages/stars unavailable (${err.message}) — keeping cached values`)
    partial.push('languages', 'stars')
  }

  let totalCommits = null
  try {
    const search = await fetchTotalCommits(token, profile.login || login)
    totalCommits = search.total
    // An incomplete search can only undercount: let the cache win if higher.
    if (search.incomplete) partial.push('totalCommits:min')
  } catch (err) {
    log.warn(`total commits unavailable (${err.message}) — keeping the cached value`)
    partial.push('totalCommits')
  }

  const publicRepos = profile.publicRepos?.totalCount ?? 0
  const totalRepos = profile.allRepos?.totalCount ?? publicRepos
  const createdAt = profile.createdAt
  const prTotal = profile.pullRequests?.totalCount ?? 0
  const prMerged = profile.mergedPullRequests?.totalCount ?? 0

  const part = {
    user: {
      login: profile.login,
      name: profile.name || profile.login,
      createdAt,
      followers: profile.followers?.totalCount ?? 0,
      following: profile.following?.totalCount ?? 0,
      publicRepos,
      privateRepos: Math.max(0, totalRepos - publicRepos),
      totalRepos,
      stars: repoStats?.stars ?? null,
      totalCommits,
      yearsOnGitHub: createdAt ? round((now.getTime() - Date.parse(createdAt)) / (365.25 * 86_400_000), 2) : null,
    },
    contributions,
    pullRequests: {
      total: prTotal,
      merged: prMerged,
      open: profile.openPullRequests?.totalCount ?? 0,
      mergeRate: prTotal ? round(prMerged / prTotal, 4) : null,
    },
    issues: { total: profile.issues?.totalCount ?? 0 },
    repositoriesContributedTo: profile.repositoriesContributedTo?.totalCount ?? 0,
    languages: repoStats?.languages ?? null,
  }
  log.info(`done in ${((Date.now() - started) / 1000).toFixed(1)}s (visibility: ${auth.visibility})`)
  return { part, visibility: auth.visibility, partial }
}

// With limited visibility, live private-dependent counts can only be lower than
// the truth: keep the higher cached value field by field (and the cached
// language mix, which public repos alone would distort).
export function reconcileWithCache(part, cached, visibility) {
  if (visibility === 'full' || !cached) return part
  const kept = []
  const max = (live, prev, label) => {
    if (Number.isFinite(prev) && (!Number.isFinite(live) || prev > live)) {
      kept.push(label)
      return prev
    }
    return live
  }
  const u = { ...part.user }
  if (cached.user) {
    u.privateRepos = max(u.privateRepos, cached.user.privateRepos, 'user.privateRepos')
    u.totalRepos = Math.max(u.totalRepos ?? 0, (u.publicRepos ?? 0) + (u.privateRepos ?? 0))
    u.stars = max(u.stars, cached.user.stars, 'user.stars')
    u.totalCommits = max(u.totalCommits, cached.user.totalCommits, 'user.totalCommits')
  }
  let pullRequests = part.pullRequests
  if (cached.pullRequests && (cached.pullRequests.total ?? 0) > (pullRequests?.total ?? 0)) {
    pullRequests = cached.pullRequests
    kept.push('pullRequests')
  }
  const issues = { total: max(part.issues?.total, cached.issues?.total, 'issues.total') }
  const repositoriesContributedTo = max(part.repositoriesContributedTo, cached.repositoriesContributedTo, 'repositoriesContributedTo')
  let languages = part.languages
  if (cached.languages?.length) {
    languages = cached.languages
    kept.push('languages')
  }
  const prevYears = new Map((cached.contributions?.byYear ?? []).map((y) => [y.year, y]))
  const byYear = (part.contributions?.byYear ?? []).map((y) => {
    const p = prevYears.get(y.year)
    if (!p) return y
    const out = { ...y }
    for (const k of ['commits', 'pullRequests', 'issues', 'reviews']) {
      if ((p[k] ?? 0) > (y[k] ?? 0)) out[k] = p[k]
    }
    return out
  })
  if (kept.length) log.warn(`limited token visibility — kept higher cached values for: ${kept.join(', ')}`)
  return {
    ...part,
    user: u,
    contributions: { ...part.contributions, totals: contributionTotals(byYear), byYear },
    pullRequests,
    issues,
    repositoriesContributedTo,
    languages,
  }
}
