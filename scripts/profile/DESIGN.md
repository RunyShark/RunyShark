# RunyShark profile — design system & generator spec

The GitHub profile README is rendered from SVGs produced by this generator. GitHub
strips CSS/JS from Markdown, so every piece of visual design lives inside SVG files
shown through `<img>`. One design system, one renderer, zero third-party image
services for the core sections.

## 1. Decisions (approved)

| Topic | Decision |
| --- | --- |
| Language | English everywhere (copy in `content.mjs`) |
| Theme | Dark only. Pure-black panels (`#000`) on GitHub's `#0d1117` page |
| Hero | "RunyShark" as a **dot-matrix wordmark** (Aceternity *pixelated canvas*) over **procedural clouds** (Aceternity *cloud shader*) |
| Contact | Email + LinkedIn (+ GitHub follow). No phone number |
| Indicators | Keep every existing indicator, restyle them, add new ones (see §5) |
| References | vercel.com/home, vercel.com/blog/ai-sdk-4-0, ui.aceternity.com cloud-shader + pixelated-canvas, the amber-glow 2FA card (Vercel dashboard) |

## 2. Visual language

Vercel / Geist dark. Restraint is the point: black, grays, one accent at a time.

- **Canvas**: every SVG is `860px` wide (GitHub's README column is ~830–846px, so
  text renders ~1:1). Standalone sections are **black rounded panels** — use
  `panel(doc)` from `core/svg.mjs` (radius 16, border `#1f1f1f`). Section headers are
  the only transparent SVGs.
- **Colour**: tokens in `core/tokens.mjs`. Text `#ededed` / `#a1a1a1` / `#878787` /
  `#454545`. Borders `#1f1f1f` (default) / `#2e2e2e` (controls). Surfaces `#0a0a0a`,
  `#111`, `#1a1a1a`. Accents used sparingly: blue `#0070f3`/`#52a8ff` for data,
  green `#62c073` for "live/ready", amber `#f5a524` for glows, the Vercel triad
  gradients for at most one highlight per SVG.
- **Type**: Geist (sans) + Geist Mono, embedded automatically via the `f-<family>-<weight>`
  classes emitted by `txt()`. Headlines 600 weight with negative tracking
  (−0.02 to −0.04em). Mono uppercase eyebrows with +0.08em tracking. Numbers in KPIs
  use 600 weight; keep digits aligned (`font-variant-numeric: tabular-nums` via
  `attrs: { style: 'font-variant-numeric:tabular-nums' }`).
- **Spacing**: 32px outer padding inside panels, 16px gaps, 8/12px radii for inner
  boxes, 36px icon tiles with radius 8.
- **Signatures**: thin grid guides with `+` crosshairs (`guide`, `crosshair`),
  top-edge highlight + soft radial glow on cards (`card({ glow })`), mono eyebrows,
  green status dots with pulse (`statusDot`, `pill`), monochrome brand logos.
- **Motion**: subtle and slow. CSS keyframes preferred (they honour the global
  `prefers-reduced-motion` rule in `createDoc`). SMIL only when CSS can't do it
  (e.g. animating geometry attributes). Nothing should flash or loop faster than ~2s.
- **No**: emoji, giphy, rainbow dividers, saturated multi-colour badge walls,
  drop shadows, bevels, text smaller than 11px, text touching panel edges.

## 3. GitHub rendering constraints (hard rules)

1. SVGs are displayed via `<img>`: no scripts, no external URLs (fonts, images,
   CSS). Everything inline. `data:` URIs are fine (verified under GitHub's CSP).
2. No `<foreignObject>`. No `mix-blend-mode`. Filters are allowed but keep them
   cheap (one `feTurbulence` layer max per SVG).
3. Every SVG has `<title>` + `<desc>` (createDoc does this — write a meaningful
   `desc`, it is the accessible text).
4. Text must never overflow its box: measure with `measure()`, wrap with `wrap()`,
   truncate with `truncate()`.
5. Keep each SVG < 300 KB (fonts are ~11 KB/weight; dot fields and paths add up).
6. Gradients on horizontal/vertical lines must use `units: 'userSpaceOnUse'`
   (zero-height bbox voids objectBoundingBox gradients).
7. IDs must be unique within an SVG (use `doc.uid()` or deterministic ids).

## 4. Architecture

```
scripts/profile/
  build.mjs            entry: collect data → render components → write assets/
  content.mjs          all copy, links, stack items, certifications
  core/                tokens, svg doc builder, text metrics, fonts, glyphs (UI icons),
                       icons (brand logos), primitives, format
  data/                collect.mjs (+ github.mjs, wakatime.mjs) → metrics model
  components/<name>.mjs   default export { name, render({ data }) → [{ path, svg }] }
  vendor/              fonts.json, metrics.json, icons.json, wordmark.json (+ licenses)
  tools/               vendor_*.py|mjs (one-off), preview.mjs, check.mjs, chrome.mjs
assets/
  hero.svg, about.svg, stack.svg, certifications.svg, buttons/*.svg, sections/*.svg
  generated/impact.svg, activity.svg, coding.svg, footer.svg, metrics.json
```

Commands:

```
node scripts/profile/build.mjs --offline --only hero          # render one component from cache
node scripts/profile/tools/preview.mjs assets/hero.svg --out x.png --scale 2 --time 3000
node scripts/profile/tools/check.mjs --no-remote               # XML + Chrome decode gate
GITHUB_TOKEN=… WAKATIME_API_KEY=… node scripts/profile/build.mjs   # live (CI)
```

`.github/workflows/profile.yml` runs the live build daily (and on pushes touching
`scripts/profile/**`), then commits changed assets. If an API fails, the collector
falls back to the cached `metrics.json`, so a broken image is never published.

## 5. Components

| File | Kind | Content |
| --- | --- | --- |
| `assets/hero.svg` | data | 860×~520 panel. Top bar: mono handle + status pill "● Shipping AI agents in production". Dot-matrix wordmark from `vendor/wordmark.json` (coverage → dot radius; deterministic dropout for texture; twinkling subset; slow light sweep). Cloud layer: `feTurbulence` fractal noise, tinted, masked, drifting. Roles line. Terminal line typing the `profile.taglines` with a blinking caret. Bottom stat strip (Vercel "450K+ / 9,000+" style): years, repositories, contributions, certifications — from metrics, with fallbacks. Grid guides + crosshairs. |
| `assets/buttons/*.svg` | static | Vercel buttons, 40px tall: `email` (primary: white fill, black text, mail glyph, "Get in touch"), `linkedin` (secondary: black, `#2e2e2e` border, logo), `github` (secondary, "Follow"), `certifications` (secondary, "View all certifications", arrow-up-right). Transparent background, exact width from measured text. |
| `assets/sections/*.svg` | static | Done (reference implementation: `components/sections.mjs`). |
| `assets/about.svg` | static | Panel with an inner card styled like the amber-glow 2FA card: halftone dot orb avatar (pink→violet, pixelated-canvas texture) with a small badge, centred title + intro, then a 2-column grid of the 8 `about.rows` (bordered rows: icon tile + title + text). |
| `assets/generated/impact.svg` | data | KPI dashboard, Vercel Analytics style: header row with title + "● Live · updated <date>". 8 tiles (4×2): contributions last 12 months (+ YoY chip + sparkline), all-time contributions, pull requests (+ merge rate), repositories (public/private split), current streak (+ longest), busiest day, daily average (+ active days), most productive weekday. |
| `assets/generated/activity.svg` | data | 53-week contribution heatmap (blue `heat` scale, month + weekday labels, legend, total), monthly trend area chart (12 months, gradient fill), contributions by weekday bars, contributions by year bars 2021→now. |
| `assets/generated/coding.svg` | data | WakaTime: total coding time (all-time), last-year hours, daily average, top language, editor, OS (with logos) + language breakdown (stacked bar + list with percentages). |
| `assets/stack.svg` | static | All `stack` categories. Left: mono category label + count. Right: wrapping chips (32px tall, icon 16px monochrome + name), measured widths. |
| `assets/certifications.svg` | static | Compact summary: 40+ Udemy, 5 DevTalles, continuous learning — tiles with logos/glyphs. The README keeps the expandable image grid / PDF tables below it. |
| `assets/generated/footer.svg` | data | Slim closing panel: small dot-matrix mark or handle, "Designed & engineered by RunyShark", "Rendered daily by GitHub Actions · last updated <date>", "● All systems operational". |

Third-party widgets kept in the README, re-themed to this palette: profile views
(komarev), followers/stars/repos (shields), streak stats, github-readme-stats +
top languages, trophies, 3D contribution skyline (workflow settings), snake (workflow
palette), Spotify now-playing. Each must be verified to render; anything that doesn't
is replaced by our own SVG.

## 6. Metrics model (`assets/generated/metrics.json`)

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-22T05:00:00.000Z",
  "sources": { "github": "live|cache", "wakatime": "live|cache|seed" },
  "user": {
    "login": "RunyShark", "name": "Dario", "createdAt": "2021-10-07T13:18:14Z",
    "followers": 17, "following": 7, "publicRepos": 15, "privateRepos": 210,
    "totalRepos": 225, "stars": 2, "yearsOnGitHub": 5.04
  },
  "contributions": {
    "allTime": 65370,               // sum of every contribution year
    "lastYear": 44771,              // rolling 365 days (GitHub calendar)
    "previousYear": 12345,          // the 365 days before that
    "yoyGrowth": 2.63,              // lastYear / previousYear - 1 (null if previousYear = 0)
    "byYear": [{ "year": 2021, "total": 1, "commits": 0, "pullRequests": 0, "issues": 0, "reviews": 0 }],
    "calendar": [{ "date": "2025-10-19", "count": 12, "level": 2 }],   // last 53 weeks, Sunday-aligned, level 0–4
    "monthly": [{ "month": "2025-11", "total": 3100 }],              // last 12 months incl. current
    "weekday": [1200, 8000, 9000, 8800, 8500, 7000, 2271],          // Sun..Sat over the last year
    "busiestWeekday": 2,
    "currentStreak": { "days": 120, "start": "2026-06-24", "end": "2026-10-21" },
    "longestStreak": { "days": 210, "start": "2025-01-02", "end": "2025-07-30" },
    "bestDay": { "date": "2026-03-04", "count": 912 },
    "activeDays": 341,
    "dailyAverage": 122.7
  },
  "pullRequests": { "total": 1755, "merged": 1685, "open": 3, "mergeRate": 0.96 },
  "issues": { "total": 14 },
  "repositoriesContributedTo": 6,
  "languages": [{ "name": "TypeScript", "color": "#3178c6", "bytes": 123456, "share": 0.62 }],
  "wakatime": {
    "allTime": { "totalSeconds": 18669600, "text": "5,186 hrs", "since": "2022-01-01" },
    "lastYear": {
      "totalSeconds": 9144000, "dailyAverageSeconds": 26160,
      "languages": [{ "name": "TypeScript", "percent": 55.0, "totalSeconds": 5029200 }],
      "editors": [{ "name": "VS Code", "percent": 98.0 }],
      "operatingSystems": [{ "name": "Windows", "percent": 100.0 }],
      "bestDay": { "date": "2026-02-10", "totalSeconds": 50400 }
    }
  }
}
```

Every component must render gracefully when any field is missing (show `—`, hide
the chip, or fall back to a static label) — never crash, never print `undefined`/`NaN`.

## 7. Quality bar

- Previews at 2× via `tools/preview.mjs` (GitHub's column on `#0d1117`), checked
  visually against the references — alignment on a grid, consistent paddings,
  no clipped or overlapping text, balanced whitespace.
- `tools/check.mjs` passes (well-formed XML, `<title>/<desc>`, decodes in Chrome,
  every README image resolves).
- Deterministic output: same data → byte-identical SVG (no random, no timestamps
  except the data's own `generatedAt`).
