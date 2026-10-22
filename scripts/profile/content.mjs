// Every piece of human-written copy on the profile lives here. Components only
// lay it out; changing a sentence, a link or a stack item never touches layout code.

export const profile = {
  login: 'RunyShark',
  handle: 'runyshark',
  name: 'Sergio Dario Moreno',
  roles: ['Full-Stack Engineer', 'AI Engineer', 'Backend Architect', 'Mobile Engineer'],
  location: 'Mexico',
  timezone: 'America/Mexico_City',
  status: 'Shipping AI agents in production',
  // Rotating lines typed out in the hero terminal.
  taglines: [
    'Clean Architecture · DDD · SOLID',
    'TypeScript · NestJS · Next.js · Expo',
    'AI agents · MCP · LLM pipelines',
    'Code is poetry, architecture is art.',
  ],
}

export const links = {
  email: 'mailto:sdmoreno51@gmail.com',
  linkedin: 'https://www.linkedin.com/in/sergio-dario-moreno-sosa-aa204022a/',
  linkedinCertifications:
    'https://www.linkedin.com/in/sergio-dario-moreno-sosa-aa204022a/details/certifications/',
  github: 'https://github.com/RunyShark',
  spotify: 'https://open.spotify.com/user/21wenupyy6frblehjdouc4sua',
}

// Section headers, in README order. `id` doubles as the SVG file name.
export const sections = [
  { id: 'about', label: 'About', title: 'Engineering products that ship — and scale.' },
  { id: 'impact', label: 'Impact', title: 'Shipping, every single day.' },
  { id: 'coding', label: 'Coding activity', title: 'Hours in the editor, measured.' },
  { id: 'stack', label: 'Stack', title: 'The tools behind the work.' },
  { id: 'certifications', label: 'Certifications', title: 'Never done learning.' },
  { id: 'analytics', label: 'GitHub analytics', title: 'The open-source footprint.' },
  { id: 'playing', label: 'Now playing', title: 'Soundtrack for deep work.' },
]

// About card rows. `glyph` refers to core/glyphs.mjs (UI icons, not brands).
export const about = {
  eyebrow: 'About',
  title: 'Engineering products that ship — and scale.',
  intro:
    'Full-stack engineer with 7+ years building high-impact digital products for established companies — production apps used by thousands of real users.',
  rows: [
    {
      glyph: 'rocket',
      title: '7+ years shipping production software',
      text: 'Enterprise-grade products, in production, for established companies.',
    },
    {
      glyph: 'layers',
      title: 'Clean Architecture, DDD & SOLID',
      text: 'Systems designed to be read, tested and changed for years.',
    },
    {
      glyph: 'bot',
      title: 'AI agents & multi-agent orchestration',
      text: 'Building AI agents, MCP integrations and agentic workflows end to end.',
    },
    {
      glyph: 'zap',
      title: 'Prompt engineering & LLM pipelines',
      text: 'Expert in prompt design, LLM pipelines and AI-powered developer tooling.',
    },
    {
      glyph: 'graduation',
      title: 'Mentor to 30+ students',
      text: 'Teaching full-stack engineering in professional bootcamps.',
    },
    {
      glyph: 'book',
      title: 'Always learning',
      text: 'Currently diving into Python & Cloud Architecture.',
    },
    {
      glyph: 'globe',
      title: 'Spanish (native) · English (learning)',
      text: 'Based in Mexico, working with teams across time zones.',
    },
    {
      glyph: 'message',
      title: 'Ask me about',
      text: 'NestJS, Next.js, React Native and System Design.',
    },
  ],
}

// Tech stack. `icon` is a simple-icons slug (vendored in vendor/icons.json);
// `glyph` is a UI icon from core/glyphs.mjs; items with neither get a monogram.
export const stack = [
  {
    title: 'Languages',
    items: [
      { name: 'TypeScript', icon: 'typescript' },
      { name: 'JavaScript', icon: 'javascript' },
      { name: 'Python', icon: 'python' },
    ],
  },
  {
    title: 'Frontend & Mobile',
    items: [
      { name: 'React 19', icon: 'react' },
      { name: 'Next.js 15', icon: 'nextdotjs' },
      { name: 'React Native', icon: 'react' },
      { name: 'Expo 54', icon: 'expo' },
      { name: 'Electron', icon: 'electron' },
      { name: 'Angular', icon: 'angular' },
      { name: 'Astro', icon: 'astro' },
      { name: 'Tailwind CSS v4', icon: 'tailwindcss' },
      { name: 'Radix UI', icon: 'radixui' },
      { name: 'NativeWind', icon: 'tailwindcss' },
      { name: 'Styled Components', icon: 'styledcomponents' },
      { name: 'Sass', icon: 'sass' },
      { name: 'Bootstrap', icon: 'bootstrap' },
      { name: 'MUI', icon: 'mui' },
      { name: 'Zustand', icon: null },
      { name: 'Redux', icon: 'redux' },
      { name: 'TanStack Query', icon: 'reactquery' },
      { name: 'React Hook Form', icon: 'reacthookform' },
      { name: 'Zod', icon: 'zod' },
      { name: 'React Router', icon: 'reactrouter' },
      { name: 'RxJS', icon: 'reactivex' },
      { name: 'Storybook', icon: 'storybook' },
    ],
  },
  {
    title: 'Backend & APIs',
    items: [
      { name: 'NestJS 11', icon: 'nestjs' },
      { name: 'Node.js', icon: 'nodedotjs' },
      { name: 'Bun', icon: 'bun' },
      { name: 'Express', icon: 'express' },
      { name: 'GraphQL', icon: 'graphql' },
      { name: 'Socket.IO', icon: 'socketdotio' },
      { name: 'JWT', icon: 'jsonwebtokens' },
      { name: 'Stripe', icon: 'stripe' },
      { name: 'Redis', icon: 'redis' },
      { name: 'Strapi', icon: 'strapi' },
    ],
  },
  {
    title: 'Databases & Cloud',
    items: [
      { name: 'PostgreSQL', icon: 'postgresql' },
      { name: 'MongoDB', icon: 'mongodb' },
      { name: 'MySQL', icon: 'mysql' },
      { name: 'Firebase', icon: 'firebase' },
      { name: 'Prisma 7', icon: 'prisma' },
      { name: 'Sequelize', icon: 'sequelize' },
      { name: 'AWS', icon: 'amazonaws' },
      { name: 'Vercel', icon: 'vercel' },
      { name: 'Cloudflare', icon: 'cloudflare' },
    ],
  },
  {
    title: 'AI & Automation',
    items: [
      { name: 'Claude', icon: 'claude' },
      { name: 'OpenAI', icon: 'openai' },
      { name: 'GitHub Copilot', icon: 'githubcopilot' },
      { name: 'MCP', icon: 'modelcontextprotocol' },
      { name: 'AI Agents', icon: null, glyph: 'bot' },
      { name: 'Prompt Engineering', icon: null, glyph: 'sparkles' },
    ],
  },
  {
    title: 'Testing',
    items: [
      { name: 'Jest', icon: 'jest' },
      { name: 'Vitest', icon: 'vitest' },
      { name: 'Testing Library', icon: 'testinglibrary' },
      { name: 'Cypress', icon: 'cypress' },
      { name: 'Playwright', icon: 'playwright' },
      { name: 'Stryker', icon: 'stryker' },
      { name: 'Postman', icon: 'postman' },
    ],
  },
  {
    title: 'DevOps & Tools',
    items: [
      { name: 'Turborepo', icon: 'turborepo' },
      { name: 'Docker', icon: 'docker' },
      { name: 'GitHub Actions', icon: 'githubactions' },
      { name: 'Git', icon: 'git' },
      { name: 'GitHub', icon: 'github' },
      { name: 'ESLint', icon: 'eslint' },
      { name: 'Babel', icon: 'babel' },
      { name: 'Jira', icon: 'jira' },
      { name: 'Slack', icon: 'slack' },
      { name: 'Trello', icon: 'trello' },
    ],
  },
]

export const certifications = {
  udemyCount: 40,
  devtallesCount: 5,
  udemyImages: [
    'UC-d6bf748f-730c-4f8f-8067-7e2e6a6dfaea',
    'UC-38fb7a1e-74a1-44b3-b3e0-fef3588fc5ff',
    'UC-b31fc6b5-f15d-416f-b5ea-fe648e2a486e',
    'UC-3696716c-4e82-4ee6-b321-44df77e7dc8c',
    'UC-50e233bb-8f13-4cd2-9005-38761997d62e',
    'UC-e5ee7eda-7103-42e7-9a01-a0413eee2835',
    'UC-02fac75e-4562-4add-a432-af88396ea730',
    'UC-0004d244-4883-41f1-9e36-b2d0446d79ef',
    'UC-8f0a3bce-6132-4d1d-9b23-a6a3497b8ed5',
    'UC-0d3ae431-04c6-4abc-a56a-e653afca691b',
    'UC-5f6b2845-4fb1-433b-8a75-ae14c45b223d',
    'UC-69db02ef-404b-468e-8a1f-797cd36ccf3c',
    'UC-b1740c66-7dfd-4adc-a48c-56c888193daa',
    'UC-e50ce600-d476-4834-9c6d-b820cd5e0c1d',
    'UC-476991d0-432f-486d-9f57-1f6f96dd4ca1',
  ],
  udemyPdfs: [
    'UC-71159d27-3038-41f2-8712-9c83c0d2fa36',
    'UC-887194f3-c135-4f03-a094-dec8f7acd831',
    'UC-ba93e0ec-bd63-4123-9371-1f54a86fda81',
    'UC-2f72d31e-5989-4f5b-8853-7cf7fd6a0007',
    'UC-8ac43057-f130-4557-8332-41146c2949d0',
    'UC-2450ea75-3e16-4dad-bdea-1ba179ec0f46',
    'UC-779c347c-46c5-4095-a54e-d3298c674350',
    'UC-992410e2-b065-468c-b194-f1834f9a577e',
    'UC-822c864f-fb3e-422f-88b7-2a0daf804a87',
    'UC-e066f3dd-a5a6-4448-ad7d-010e727fc985',
    'UC-4bf8773f-d982-4ba3-b85b-59071db805cb',
    'UC-999cb8a3-4efa-439d-85fe-f2f754005557',
    'UC-b2b685bc-e3cc-4526-aada-7f7fc014d789',
    'UC-9ecc0cd3-1963-4f9c-87df-3da6bcc1d378',
    'UC-a3b7145b-de8a-4b17-ae8e-421af4600279',
    'UC-37c4b311-29c5-4818-9914-c5b8b495ac8c',
    'UC-685fc082-2d57-4f6c-9183-73a749b78b64',
    'UC-62d89a10-02f5-42bd-9173-126268feacdb',
    'UC-3c66aa61-6ca0-4538-99b3-5b4e6e5b44be',
    'UC-aa4304ef-ccee-4927-bef0-f887b1754685',
  ],
  devtalles: ['vq6skylywa', '2pxghejbg4', 'puokbdneuy', 'pinjd1dtv1', 'vqkxytr10b'],
}

// Brand icons needed outside the stack (buttons, WakaTime card, certifications…).
export const extraIcons = [
  'github',
  'gmail',
  'linkedin',
  'wakatime',
  'visualstudiocode',
  'windows',
  'udemy',
  'spotify',
  'typescript',
  'markdown',
  'json',
  'gnubash',
  'powershell',
  'javascript',
  'css',
  'html5',
  'python',
]
