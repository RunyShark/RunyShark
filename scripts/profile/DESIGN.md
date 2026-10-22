# RunyShark profile — design system & generator spec

The GitHub profile README is rendered from SVGs produced by this generator. GitHub
strips CSS/JS from Markdown, so every piece of visual design lives inside SVG files
shown through `<img>`. One design system, one renderer, zero third-party image
services for the core sections.

## 1. Decisions (approved)

| Topic | Decision |
| --- | --- |
| Positioning (v2) | **Principal Engineer and AI expert**, not "just full-stack": leads 60 engineers, orchestrates 100+ AI agents in parallel with agent harnesses; Claude Code, Codex, MCP, RAG, embeddings, vector search, automations, cloud. Full-stack depth stays as proof, not as the headline. Claims live in `profile.claims` (`content.mjs`) — the only numbers not read from metrics |
| Language | English everywhere (copy in `content.mjs`) |
| Theme | Dark only. Pure-black panels (`#000`) on GitHub's `#0d1117` page |
| Hero | "RunyShark" as a **dot-matrix wordmark** (Aceternity *pixelated canvas*) over **procedural clouds** (Aceternity *cloud shader*) |
| Contact | Email + LinkedIn (+ GitHub follow). No phone number |
| Indicators | Keep every existing indicator, restyle them, add new ones (see §5) |
| References | vercel.com/home ("Agentic Infrastructure": glowing triangle + halo, two-tone statements, radial vignettes, particle/dither visuals), openai.com/es-ES/api (starfield "model cards", Build / Contextualize / Act gradient pillars, agents.py editor mock, check-list enterprise cards), vercel.com/blog/ai-sdk-4-0, ui.aceternity.com cloud-shader + pixelated-canvas, the amber-glow 2FA card (Vercel dashboard) |
| Motion (v2) | "Everything alive, nothing frantic": every panel has an ambient layer + one signature motion, from the shared kit `core/motion.mjs` (§2.1 rule 6) |

## 2. Visual language

Vercel / Geist dark. Restraint is the point: black, grays, one accent at a time.

- **Canvas**: every SVG is `860px` wide (GitHub's README column is ~830–846px, so
  text renders ~1:1). Standalone sections are **black rounded panels** — use
  `panel(doc)` from `core/svg.mjs` (radius 16, border `#1f1f1f`). Section headers are
  the only transparent SVGs.
- **Colour**: tokens in `core/tokens.mjs`. Text `#ededed` / `#a1a1a1` / `#878787`
  (`#454545` is for strokes and guides only, never for text). Borders `#1f1f1f`
  (default) / `#2e2e2e` (controls). Surfaces `#0a0a0a`, `#111`, `#1a1a1a`. Accents:
  see rule 5 below.
- **Type**: Geist (sans) + Geist Mono, embedded automatically via the `f-<family>-<weight>`
  classes emitted by `txt()`. Headlines 600 weight with negative tracking
  (−0.02 to −0.04em). Sizes: rule 3 below.
- **Spacing**: 32px outer padding inside panels, 16px gaps, 8/12px radii for inner
  boxes, 36px icon tiles (radius 8) in content, 28px tiles (radius 7) in toolbars.
- **Signatures**: thin grid guides with `+` crosshairs (`guide`, `crosshair`),
  top-edge highlight + soft radial glow on cards (`card({ glow })`), mono eyebrows,
  green status dots (`statusDot`, `pill`), monochrome brand logos. v2 adds the AI
  layer: deep-space starfields with 4-point flare stars, agent constellations with
  data pulses, border beams and shine sweeps (`core/motion.mjs`).
- **Motion**: CSS keyframes preferred (they honour the global `prefers-reduced-motion`
  rule in `createDoc`); SMIL only when CSS can't do it. Slow: ambient loops ≥ 3s.
  What moves and how: rule 6 below (Motion policy v2).
- **No**: emoji, giphy, rainbow dividers, saturated multi-colour badge walls,
  drop shadows, bevels, text smaller than 11px, text touching panel edges.

### 2.1 Panel system rules

Shared code: `components/shared/panel.mjs` (frame, type scale, chips, freshness) and
the copy/time helpers in `core/format.mjs`. Components import these instead of
hard-coding sizes, colours or status logic.

1. **Toolbar.** Every data panel opens with `panelHeader(doc, { icon, title, subtitle, pills })`:
   64px tall, 28px monochrome icon tile at the 32px padding, title 15/600 `#ededed`,
   subtitle 13px `#a1a1a1`, pills right-aligned (period pill + status pill), hairline
   below. Content aligns to the same 32px padding. No second headline inside a panel
   (the section header above it is the headline); a data statement may stay as one
   KPI line at 18–20px (`TYPE.statement`).
2. **No numbering inside panels.** "CONTRIBUTION GRAPH", not "01 CONTRIBUTION GRAPH".
   Numbers belong to section headers only.
3. **Type scale** (`TYPE`): hero stats 40/600 −0.04em · panel KPIs 32/600 −0.04em ·
   secondary numbers 24/600 · eyebrows = `eyebrow()` (12px Geist Mono, +0.08em,
   uppercase, `#878787`) · body 13–14px · 11px only for axis ticks and the footer strip.
   Text is never darker than `#878787`. Numbers use tabular figures (`NUMERIC`);
   `metric()` draws number + unit ("5,186h", "122/day": unit 2px after, gray, no space).
4. **Footer.** One style, `panelFooter(doc, { y, left, right })`: mono 11px
   "LABEL value" pairs, label uppercase `#878787`, value as written `#a1a1a1`, e.g.
   `SOURCE GitHub GraphQL API · incl. private repositories` … `WINDOW 368 days · UTC−6`.
5. **Colour discipline.** Green only for positive deltas and live status; blue only
   for data series; amber only for light/glow. Every other chip is neutral (`#1a1a1a`
   fill, `#2e2e2e` border, `#ededed` text): `chip({ tone })`, `deltaChip({ ratio })`.
   Pink/violet only for the identity orb (hero, about).
   **AI accent** — blue → cyan → violet (`#52a8ff`, `#47c9e5`, `#a78bfa`; `AI` in
   `core/motion.mjs`) — only in AI / hero / leadership visuals: agent packets, network
   glows, the OpenAI-style gradient pillars. Never on chips or body text.
   **Trophies** — gold/amber metal gradients (`#f5a524`, `#ffd27a`, `#b7791f`) for the top
   tier, silver/bronze metals for lower tiers; only in the Hall of fame.
6. **Motion policy v2 — "Everything alive, nothing frantic."**
   - Every panel gets an ambient layer (starfield twinkle and/or drifting particles) plus
     at least one signature motion (border beam, data pulses along edges, shine sweep,
     orbit, blinking agents). Build them from `core/motion.mjs`, not ad hoc.
   - Animate only `opacity` and `transform` (and `stroke-dashoffset` for beams/pulses).
     CSS keyframes, so the global reduced-motion rule in `createDoc` stops them. Loops
     ≥ 3s, staggered deterministic phases (negative `animation-delay`, `stagger()`).
   - **The resting state must look complete**: with `animation:none` (reduced motion, and
     renderers that don't animate) nothing important may be invisible. Never rely on an
     animation to reveal text.
   - Text never moves (exception: the hero typing terminal; log lines in the AI terminal
     may fade in/out, but each line must be readable at rest).
   - Each SVG < 300 KB and roughly ≤ 300 animated elements. Repeated shapes/icons via
     `<symbol>`/`<use>` (or a `<g id>` in defs). Deterministic: seeded PRNG only
     (`rng(seed)`), no `Math.random`, no `Date.now`.
   - Rotations: `transform-box: fill-box` or `view-box` with an explicit
     `transform-origin` in px (`orbit()` does this).
7. **Freshness truth.** `freshness(data, 'github' | 'wakatime')` reads `data.sources`:
   "Live" (green dot) only when that source is `'live'`; otherwise "Cached · <date>"
   (gray dot), "Snapshot" for the WakaTime seed, "Partial · <date>" for partial data,
   "No data" when nothing is known. The date is the source's own timestamp
   (`sources.<key>At`, falling back to `generatedAt`) shown in `profile.timezone`
   (America/Mexico_City). Every human-facing date goes through `dateInZone()` /
   `dateRange()`.
8. **Copy.** Sentence case. Plural-correct (`plural()`, `quantity()`: "1 day", "2 days").
   Negatives use U+2212 "−" (`MINUS`, `signedPercent()`, `utcOffset()`). A delta that
   rounds to 0 is hidden (`signedPercent()` → `null`). One-day ranges show one date.

| Export | Use |
| --- | --- |
| `panelHeader`, `toolbarPill`, `periodPill`, `freshnessPill` | toolbar and its pills |
| `panelFooter` | provenance strip |
| `freshness` | `{ state, live, label, date, at, text }` per source |
| `TYPE`, `INK`, `NUMERIC`, `PANEL`, `eyebrow`, `metric` | type scale, text colours, layout |
| `CHIP`, `chipTone`, `chip`, `deltaChip` | chip palette |
| `format.mjs`: `plural`, `quantity`, `signedPercent`, `dateInZone`, `dateRange`, `utcOffset`, `zonedParts`, `MINUS` | copy and time |

### 2.2 Motion kit — `core/motion.mjs`

Pure functions returning SVG markup (built with `h()`); each registers its keyframes and
classes once through `doc.css` (all prefixed `mk-`), durations and phases go inline.
Every position, size, colour and phase derives from `seed`, so output is byte-identical
run to run. `delay` params are a phase in seconds (applied as a negative
`animation-delay`, so loops are already running at load and never sync up).

| Export | Use |
| --- | --- |
| `rng(seed)` | mulberry32 PRNG (strings hashed). `r()` → [0,1); `r.range(a,b)`, `r.int(a,b)`, `r.pick(list)`, `r.chance(p)` |
| `stagger(i, n, period)` | phase for item i of n over one loop → `'-1.5s'` |
| `AI`, `STAR` | AI accent (`blue`, `cyan`, `violet`) and star colours (`white`, `pale`, `blue`, `amber`) |
| `starfield(doc, { x, y, w, h, count, seed, flares, colors, twinkle, avoid, opacity })` | stars r 0.4–1.6 (≈62% white, 30% pale blue, 8% amber); `twinkle` share bucketed into 3 variants (3.4/5.8/8.6s) × 4 phases (≤ 12 animated groups); `flares` 4-point flare stars (tapered cross + halo, one `<use>` each) breathing 6–10s. No nebula: add your own gradient |
| `particles(doc, { x, y, w, h, count, seed, direction, colors, sizes, opacity, duration, avoid })` | `'drift'`: dots wander a few px and breathe (≈12s); `'up'`: sparks rise 35–80% of h and fade (≈9s). One animated circle each |
| `constellation(doc, { x, y, w, h, nodes, seed, k, pulses, avoid, color, edgeOpacity, nodeR, pulseColors, pulseDuration })` | agent network: nodes (min-distance scatter, `avoid` rects), k-nearest edges (deduplicated, one `<path>`), twinkling nodes, `pulses` longest edges carrying a moving AI-accent dash → `{ markup, nodes, edges }` |
| `pulseAlong(doc, { d, color, duration, delay, length, width, glow, rest, opacity })` | bright dash travelling along any path (`pathLength=100`, `length` in %); `rest` = idle share of the loop; faint 3× twin as glow. Rests 40% along the path |
| `borderBeam(doc, { x, y, w, h, r, color, duration, length, delay, width, opacity })` | segment travelling clockwise around a rounded rect (`pathLength=1000`, `length` in ‰): dim tail + white head + blurred twin (`#mk-blur`, defined once). Rests on the top edge |
| `shineSweep(doc, { x, y, w, h, r, duration, delay, angle, opacity, color, band })` | diagonal light band crossing a rect during the first 45% of the loop, clipped (`doc.uid` clip id). Rests off-canvas |
| `orbit(doc, { cx, cy, r, count, duration, seed, dot: { r, fill }, ring, reverse, delay })` | dots rotating rigidly around (cx, cy) (`transform-box: view-box`, origin in px — works inside translated groups), optional dashed track |

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
                       icons (brand logos), primitives, format, motion (animation kit)
  data/                collect.mjs (+ github.mjs, wakatime.mjs) → metrics model
  components/<name>.mjs   default export { name, render({ data }) → [{ path, svg }] }
  vendor/              fonts.json, metrics.json, icons.json, wordmark.json (+ licenses)
  tools/               vendor_*.py|mjs (one-off), preview.mjs, check.mjs, chrome.mjs
assets/
  hero.svg, about.svg, ai.svg, ai-cards.svg, leadership.svg, stack.svg,
  certifications.svg, buttons/*.svg, sections/*.svg
  generated/trophies.svg, impact.svg, activity.svg, coding.svg, footer.svg, metrics.json
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

README order (v2): hero → contact buttons → counters → 01 About → 02 AI systems
(`ai.svg` + `ai-cards.svg`) → 03 Leadership → 04 Hall of fame (trophies) → 05 Impact
(impact + activity) → 06 Coding → 07 Expertise (stack) → 08 Certifications →
09 GitHub analytics (third-party) → footer. Section headers come from `sections` in
`content.mjs`, in that order.

| File | Kind | Content |
| --- | --- | --- |
| `assets/hero.svg` | data | 860×552 panel. Top bar: mono handle + status pill "● Orchestrating 100+ AI agents in production" (`profile.status`). Dot-matrix wordmark from `vendor/wordmark.json` (coverage → dot radius; deterministic dropout for texture; twinkling subset; slow light sweep) over a neural constellation / starfield and the cloud layer (fractal noise baked at build time into a PNG data URI, tinted, masked, drifting — no runtime filters). Roles line (`profile.roles`: Principal Engineer · AI Architect · …). Terminal line typing the `profile.taglines` with a blinking caret. Bottom stat strip (Vercel "450K+ / 9,000+" style): the `profile.claims` (7+ years, 60 engineers led, 100+ agents in parallel) plus metrics (contributions, repositories), with fallbacks. Grid guides + crosshairs. |
| `assets/ai.svg` | static | AI systems showcase (OpenAI "agents platform" + Vercel "Agentic Infrastructure"): an orchestrator hub coordinating the `ai.roles` hubs (planner, architect, builders, reviewers, verifiers, release) with agent packets pulsing along the edges (AI accent), an orchestration terminal streaming `ai.log` (lines readable at rest), and the four `ai.pillars` (Orchestrate / Ground / Act / Verify) as gradient art cards with frosted icon tiles. Starfield ambient layer. |
| `assets/ai-cards.svg` | static | Three OpenAI-style "model cards" (`ai.cards`: Agent Harness, RAG Engine, Automation Mesh) on deep-space starfields with flare stars and a faint nebula: big title bottom-left, mono spec lines ("Agents in parallel 100+") under it, border beam / shine sweep as the signature motion. |
| `assets/leadership.svg` | data | Engineering organization: a Principal Engineer leading `leadership.people` (60) engineers drawn as an org constellation, delivery stats from metrics (pull requests + merge rate, commits, weeks shipping), and the four `leadership.pillars` (technical direction, AI-first culture, quality at scale, mentorship — 30+ students). |
| `assets/generated/trophies.svg` | data | Hall of fame: trophy cabinet, rarest first (SSS rank, Pull Shark, God Committer, Super Puller, weekly streak, Village Elder, Rainbow Lang User, …). Tiers derived from `metrics.json` at render time — never hard-coded; gold/amber metal for the top tier, silver/bronze below (rule 5). Shine sweeps on the metals, starfield behind. |
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
