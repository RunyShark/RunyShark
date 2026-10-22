// Design tokens: the single source of truth for every colour, size and timing
// used by the profile. Palette follows Vercel's Geist dark theme.

export const color = {
  // surfaces
  bg: '#000000',
  surface: '#0a0a0a',
  surface2: '#111111',
  surface3: '#1a1a1a',
  // borders
  border: '#1f1f1f',
  borderStrong: '#2e2e2e',
  borderHover: '#454545',
  // text
  text: '#ededed',
  textSecondary: '#a1a1a1',
  textTertiary: '#878787',
  textMuted: '#454545',
  // accents
  blue: '#0070f3',
  blueBright: '#52a8ff',
  blueDeep: '#0a2a4f',
  green: '#45a557',
  greenBright: '#62c073',
  amber: '#f5a524',
  amberDeep: '#5c3a05',
  pink: '#ff4d8d',
  purple: '#8e4ec6',
  purpleBright: '#bf7af0',
  red: '#e5484d',
  cyan: '#50e3c2',
}

// Vercel's classic gradient triad (Develop / Preview / Ship).
export const gradient = {
  develop: ['#007cf0', '#00dfd8'],
  preview: ['#7928ca', '#ff0080'],
  ship: ['#ff4d4d', '#f9cb28'],
}

// Five-step scale for contribution intensity (empty → max).
export const heat = ['#161616', '#0a3069', '#0b58b8', '#2f8af5', '#9ccbff']

export const fontStack = {
  sans: "Geist, Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace",
}

export const type = {
  display: { size: 40, weight: 600, tracking: -0.04 },
  h1: { size: 28, weight: 600, tracking: -0.035 },
  h2: { size: 20, weight: 600, tracking: -0.02 },
  h3: { size: 16, weight: 600, tracking: -0.01 },
  body: { size: 14, weight: 400, tracking: 0 },
  small: { size: 13, weight: 400, tracking: 0 },
  label: { size: 12, weight: 500, tracking: 0 },
  eyebrow: { size: 12, weight: 400, tracking: 0.08, family: 'mono' },
  kpi: { size: 32, weight: 600, tracking: -0.04 },
}

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 9999 }

// Every SVG is drawn on an 860px-wide canvas: GitHub's profile README column is
// ~830–846px on desktop, so text renders close to 1:1.
export const layout = { width: 860, pad: 32, gap: 16 }

export const motion = {
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '24s',
  medium: '6s',
  fast: '2s',
}
