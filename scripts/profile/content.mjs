// Every piece of human-written copy on the profile lives here. Components only
// lay it out; changing a sentence, a link or a stack item never touches layout code.

export const profile = {
  login: 'RunyShark',
  handle: 'runyshark',
  name: 'Sergio Dario Moreno',
  roles: ['Principal Engineer', 'AI Architect', 'Multi-Agent Systems', 'Engineering Leader'],
  // Headline claims, reused by the hero strip, About and Leadership.
  claims: {
    yearsShipping: '7+',
    engineersLed: 60,
    parallelAgents: '100+',
  },
  location: 'Mexico',
  timezone: 'America/Mexico_City',
  status: 'Orchestrating 100+ AI agents in production',
  // Rotating lines typed out in the hero terminal.
  taglines: [
    'orchestrate --agents 100+ --parallel --verify',
    'Claude Code · Codex · MCP · agent harnesses',
    'RAG · embeddings · vector search · evals',
    'Leading 60 engineers, prompt to production',
    'Clean Architecture · DDD · SOLID, at scale',
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
  { id: 'about', label: 'About', title: 'Principal Engineer. AI-native by design.' },
  { id: 'ai', label: 'AI systems', title: 'Agentic engineering, at production scale.' },
  { id: 'leadership', label: 'Leadership', title: 'Leading 60 engineers into the agentic era.' },
  { id: 'trophies', label: 'Hall of fame', title: 'The hardest ones to earn.' },
  { id: 'impact', label: 'Impact', title: 'Shipping, week after week.' },
  { id: 'coding', label: 'Coding activity', title: 'Hours in the editor, measured.' },
  { id: 'stack', label: 'Expertise', title: 'Expert across the entire stack.' },
  { id: 'certifications', label: 'Certifications', title: 'Never done learning.' },
  { id: 'analytics', label: 'GitHub analytics', title: 'The GitHub footprint.' },
  { id: 'playing', label: 'Now playing', title: 'Soundtrack for deep work.' },
]

// About card rows. `glyph` refers to core/glyphs.mjs (UI icons, not brands).
export const about = {
  eyebrow: 'About',
  title: 'Principal Engineer. AI-native by design.',
  intro:
    'Principal Engineer and AI expert leading 60 engineers. I design the agent harnesses that orchestrate 100+ AI agents in parallel, and ship them to production on architecture built to last.',
  rows: [
    {
      glyph: 'users',
      title: 'Principal Engineer · 60-person org',
      text: 'Technical direction, architecture and engineering standards for 60 engineers.',
    },
    {
      glyph: 'bot',
      title: '100+ AI agents, orchestrated in parallel',
      text: 'Harnesses of planners, builders, reviewers and verifiers working as one team.',
    },
    {
      glyph: 'terminal',
      title: 'Claude Code & Codex, at expert level',
      text: 'Agentic coding with custom skills, hooks, subagents, workflows and MCP servers.',
    },
    {
      glyph: 'layers',
      title: 'RAG, embeddings & vector search',
      text: 'Retrieval pipelines, semantic search, reranking and grounded answers.',
    },
    {
      glyph: 'zap',
      title: 'LLM pipelines, evals & guardrails',
      text: 'Prompt engineering, structured outputs and adversarial verification.',
    },
    {
      glyph: 'activity',
      title: 'AI automation, end to end',
      text: 'Event-driven automations that wire agents into real business workflows.',
    },
    {
      glyph: 'shieldCheck',
      title: 'Clean Architecture, DDD & SOLID',
      text: '7+ years shipping enterprise systems designed to be changed for years.',
    },
    {
      glyph: 'globe',
      title: 'Cloud-native, full-stack depth',
      text: 'AWS, serverless and containers. TypeScript end to end, web to mobile.',
    },
  ],
}

// AI systems section: the orchestration showcase and the three "model cards".
export const ai = {
  // Agent roles drawn as hubs around the orchestrator, clockwise from the top.
  roles: ['Planner', 'Architect', 'Builders', 'Reviewers', 'Verifiers', 'Release'],
  // Pillars (OpenAI "Build / Contextualize / Act" style), left to right.
  pillars: [
    {
      glyph: 'cpu',
      title: 'Orchestrate',
      text: 'Harnesses, subagents and workflows running 100+ agents at once.',
    },
    {
      glyph: 'layers',
      title: 'Ground',
      text: 'RAG over embeddings and vector search, plus MCP for live context.',
    },
    {
      glyph: 'zap',
      title: 'Act',
      text: 'Tool calling and automations wired into GitHub, Slack and clouds.',
    },
    {
      glyph: 'shieldCheck',
      title: 'Verify',
      text: 'Evals, guardrails and adversarial review before anything ships.',
    },
  ],
  // Streaming log lines shown in the orchestration terminal.
  log: [
    'harness.spawn   planner        ok',
    'fan-out         100+ agents    running',
    'rag.retrieve    top-k 12       grounded',
    'review          adversarial    3/3 pass',
    'verify          typecheck+e2e  green',
    'release         main           shipped',
  ],
  // OpenAI-style "model cards" (starfield background, title, spec lines).
  cards: [
    {
      title: 'Agent Harness',
      specs: [
        ['Agents in parallel', '100+'],
        ['Roles', 'plan · build · review · verify'],
        ['Runtime', 'Claude Code · Codex · SDKs'],
      ],
    },
    {
      title: 'RAG Engine',
      specs: [
        ['Retrieval', 'embeddings · hybrid search'],
        ['Stores', 'pgvector · Pinecone · Redis'],
        ['Quality', 'reranking · evals · citations'],
      ],
    },
    {
      title: 'Automation Mesh',
      specs: [
        ['Triggers', 'webhooks · queues · cron'],
        ['Tools', 'MCP · function calling'],
        ['Delivery', 'GitHub Actions · serverless'],
      ],
    },
  ],
}

// Leadership section. Only the 60-person org and the mentoring count are
// claims; delivery numbers come from metrics at render time.
export const leadership = {
  people: 60,
  pillars: [
    {
      glyph: 'rocket',
      title: 'Technical direction',
      text: 'Architecture vision, roadmaps and the standards 60 engineers build on.',
    },
    {
      glyph: 'bot',
      title: 'AI-first engineering culture',
      text: 'Every team pairs with agents: harnesses, skills and reviews built in-house.',
    },
    {
      glyph: 'gitPullRequest',
      title: 'Quality at scale',
      text: 'Design reviews, code reviews and verification gates on every change.',
    },
    {
      glyph: 'graduation',
      title: 'Mentorship',
      text: 'Growing senior engineers, plus 30+ bootcamp students mentored.',
    },
  ],
}

// Tech stack. `icon` is a simple-icons slug (vendored in vendor/icons.json);
// `glyph` is a UI icon from core/glyphs.mjs; items with neither get a monogram.
// `level` is the proficiency label shown next to each category.
export const stack = [
  {
    title: 'AI & Agents',
    level: 'Expert',
    items: [
      { name: 'Claude Code', icon: 'claude' },
      { name: 'OpenAI Codex', icon: 'openai' },
      { name: 'Claude API', icon: 'anthropic' },
      { name: 'OpenAI API', icon: 'openai' },
      { name: 'Gemini', icon: 'googlegemini' },
      { name: 'MCP', icon: 'modelcontextprotocol' },
      { name: 'Vercel AI SDK', icon: 'vercel' },
      { name: 'LangChain', icon: 'langchain' },
      { name: 'LangGraph', icon: 'langgraph' },
      { name: 'LlamaIndex', icon: null, glyph: 'book' },
      { name: 'Hugging Face', icon: 'huggingface' },
      { name: 'Ollama', icon: 'ollama' },
      { name: 'GitHub Copilot', icon: 'githubcopilot' },
      { name: 'Cursor', icon: 'cursor' },
      { name: 'Multi-agent orchestration', icon: null, glyph: 'bot' },
      { name: 'Agent harnesses', icon: null, glyph: 'cpu' },
      { name: 'Prompt engineering', icon: null, glyph: 'sparkles' },
    ],
  },
  {
    title: 'RAG & Retrieval',
    level: 'Expert',
    items: [
      { name: 'Embeddings', icon: null, glyph: 'layers' },
      { name: 'Vector search', icon: null, glyph: 'gauge' },
      { name: 'pgvector', icon: 'postgresql' },
      { name: 'Pinecone', icon: null },
      { name: 'Qdrant', icon: 'qdrant' },
      { name: 'Redis Vector', icon: 'redis' },
      { name: 'Hybrid search', icon: null, glyph: 'activity' },
      { name: 'Reranking', icon: null, glyph: 'trendingUp' },
      { name: 'Evals & guardrails', icon: null, glyph: 'shieldCheck' },
    ],
  },
  {
    title: 'Automation',
    level: 'Expert',
    items: [
      { name: 'n8n', icon: 'n8n' },
      { name: 'Zapier', icon: 'zapier' },
      { name: 'Make', icon: 'make' },
      { name: 'GitHub Actions', icon: 'githubactions' },
      { name: 'Webhooks', icon: null, glyph: 'zap' },
      { name: 'BullMQ queues', icon: null, glyph: 'box' },
      { name: 'Cron & schedulers', icon: null, glyph: 'clock' },
      { name: 'Tool calling', icon: null, glyph: 'code' },
    ],
  },
  {
    title: 'Languages',
    level: 'Expert',
    items: [
      { name: 'TypeScript', icon: 'typescript' },
      { name: 'JavaScript', icon: 'javascript' },
      { name: 'Python', icon: 'python' },
      { name: 'SQL', icon: null, glyph: 'box' },
      { name: 'Bash', icon: 'gnubash' },
      { name: 'PowerShell', icon: 'powershell' },
      { name: 'HTML5', icon: 'html5' },
      { name: 'CSS', icon: 'css' },
      { name: 'SCSS', icon: 'sass' },
      { name: 'Handlebars', icon: 'handlebarsdotjs' },
      { name: 'MDX', icon: 'mdx' },
      { name: 'GraphQL', icon: 'graphql' },
      { name: 'Markdown', icon: 'markdown' },
      { name: 'JSON', icon: 'json' },
      { name: 'YAML', icon: 'yaml' },
    ],
  },
  {
    title: 'Frontend & Mobile',
    level: 'Expert',
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
      { name: 'shadcn/ui', icon: 'shadcnui' },
      { name: 'NativeWind', icon: 'tailwindcss' },
      { name: 'Styled Components', icon: 'styledcomponents' },
      { name: 'Sass', icon: 'sass' },
      { name: 'MUI', icon: 'mui' },
      { name: 'Zustand', icon: null },
      { name: 'Redux', icon: 'redux' },
      { name: 'TanStack Query', icon: 'reactquery' },
      { name: 'React Hook Form', icon: 'reacthookform' },
      { name: 'Zod', icon: 'zod' },
      { name: 'React Router', icon: 'reactrouter' },
      { name: 'RxJS', icon: 'reactivex' },
      { name: 'Framer Motion', icon: 'framer' },
      { name: 'Storybook', icon: 'storybook' },
    ],
  },
  {
    title: 'Backend & APIs',
    level: 'Expert',
    items: [
      { name: 'NestJS 11', icon: 'nestjs' },
      { name: 'Node.js', icon: 'nodedotjs' },
      { name: 'Bun', icon: 'bun' },
      { name: 'Express', icon: 'express' },
      { name: 'FastAPI', icon: 'fastapi' },
      { name: 'GraphQL', icon: 'graphql' },
      { name: 'REST & OpenAPI', icon: 'openapiinitiative' },
      { name: 'WebSockets', icon: 'socketdotio' },
      { name: 'JWT', icon: 'jsonwebtokens' },
      { name: 'Stripe', icon: 'stripe' },
      { name: 'Strapi', icon: 'strapi' },
      { name: 'Microservices', icon: null, glyph: 'box' },
      { name: 'Event-driven', icon: null, glyph: 'activity' },
    ],
  },
  {
    title: 'Cloud & Infra',
    level: 'Expert',
    items: [
      { name: 'AWS', icon: 'amazonaws' },
      { name: 'Google Cloud', icon: 'googlecloud' },
      { name: 'Azure', icon: 'microsoftazure' },
      { name: 'Vercel', icon: 'vercel' },
      { name: 'Cloudflare', icon: 'cloudflare' },
      { name: 'Firebase', icon: 'firebase' },
      { name: 'Supabase', icon: 'supabase' },
      { name: 'Docker', icon: 'docker' },
      { name: 'Kubernetes', icon: 'kubernetes' },
      { name: 'Terraform', icon: 'terraform' },
      { name: 'Serverless', icon: null, glyph: 'zap' },
    ],
  },
  {
    title: 'Databases',
    level: 'Expert',
    items: [
      { name: 'PostgreSQL', icon: 'postgresql' },
      { name: 'MongoDB', icon: 'mongodb' },
      { name: 'MySQL', icon: 'mysql' },
      { name: 'Redis', icon: 'redis' },
      { name: 'Prisma 7', icon: 'prisma' },
      { name: 'Sequelize', icon: 'sequelize' },
      { name: 'TypeORM', icon: 'typeorm' },
    ],
  },
  {
    title: 'Testing & Quality',
    level: 'Expert',
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
    level: 'Expert',
    items: [
      { name: 'Turborepo', icon: 'turborepo' },
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

// Hall of fame snapshot (verified 2026-10-22). GitHub does not expose achievements
// or github-profile-trophy ranks through its API, so tiers and ranks are copied
// from the public pages; every number on the cards still comes from metrics.json.
//   github:   github.com/RunyShark?tab=achievements (tier label: x4 gold, x2 bronze)
//   trophies: github-trophies.vercel.app/?username=runyshark (rank per trophy)
export const achievements = {
  verifiedAt: '2026-10-22',
  github: [
    { id: 'pull-shark', name: 'Pull Shark', tier: 'gold', count: 4 },
    { id: 'pair-extraordinaire', name: 'Pair Extraordinaire', tier: 'bronze', count: 2 },
    { id: 'quickdraw', name: 'Quickdraw', tier: null, count: 1 },
    { id: 'yolo', name: 'YOLO', tier: null, count: 1 },
  ],
  trophies: [
    { id: 'AchieveSSSRank', name: 'SSS Rank Hacker', rank: 'SECRET', points: 'Have SSS Rank' },
    { id: 'Commits', name: 'God Committer', rank: 'SSS', points: '44.8k' },
    { id: 'PullRequest', name: 'Super Puller', rank: 'S', points: '172' },
    { id: 'MultiLanguage', name: 'Rainbow Lang User', rank: 'SECRET', points: '8' },
    { id: 'LongTimeUser', name: 'Village Elder', rank: 'SECRET', points: '5 years' },
  ],
}
