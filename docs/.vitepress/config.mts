import { defineConfig } from 'vitepress'
import { mermaid } from './plugins/mermaid.ts'
import { gruvboxShiki } from './theme/shiki.ts'

export default defineConfig({
  title: 'Trana Protocol',
  description:
    'Parametric drought reinsurance on Solana — Anchor program architecture, instructions, and workflows.',
  lang: 'en-US',
  cleanUrls: true,
  srcExclude: ['**/README.md'],
  // Dark-only: `false` hides the appearance switch entirely and VitePress never
  // adds its `.dark` class, so `theme/custom.css` carries the gruvbox palette on
  // `:root` and the Shiki theme below is a single (not light/dark) theme.
  appearance: false,
  markdown: {
    lineNumbers: true,
    theme: gruvboxShiki,
    config: (md) => {
      md.use(mermaid)
    },
  },
  // Matches --vp-c-bg so the browser chrome blends with the page.
  head: [['meta', { name: 'theme-color', content: '#1d2021' }]],
  vite: {
    build: {
      // The only chunk above Vite's 500 kB default is mermaid's ELK layout
      // engine (~1.4 MB), which mermaid 12 imports for its default flowchart
      // layout. It is emitted because it stays in mermaid's module graph even
      // though `flowchart.layout: 'dagre'` (see theme/index.ts) means no page
      // ever fetches it. Measured initial payload is ~300 kB and ~1.2 MB on a
      // diagram page, so this limit still catches genuine regressions in
      // eagerly-loaded code.
      chunkSizeWarningLimit: 1500,
    },
  },
  themeConfig: {
    outline: { level: [2, 3] },
    nav: [
      { text: 'Overview', link: '/introduction/overview' },
      { text: 'Protocol', link: '/protocol/architecture' },
      { text: 'Workflows', link: '/workflows/lifecycle' },
      { text: 'Reference', link: '/reference/seeds' },
      {
        text: 'Development',
        items: [
          { text: 'Local Setup', link: '/development/local-setup' },
          { text: 'Testing', link: '/development/testing' },
          { text: 'Docs Toolchain', link: '/development/docs-toolchain' },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/introduction/overview' },
          { text: 'Actors & Roles', link: '/introduction/actors' },
          { text: 'Scope & Status', link: '/introduction/scope' },
        ],
      },
      {
        text: 'Protocol',
        items: [
          { text: 'Architecture', link: '/protocol/architecture' },
          { text: 'Accounts & State', link: '/protocol/accounts' },
          { text: 'Instructions', link: '/protocol/instructions' },
          { text: 'Invariants', link: '/protocol/invariants' },
          { text: 'Economics', link: '/protocol/economics' },
        ],
      },
      {
        text: 'Workflows',
        items: [
          { text: 'Pool Lifecycle', link: '/workflows/lifecycle' },
          { text: 'LP Capital', link: '/workflows/lp-capital' },
          { text: 'Policy Settlement', link: '/workflows/policy-settlement' },
        ],
      },
      {
        text: 'Security',
        items: [
          { text: 'Threat Model', link: '/security/threat-model' },
          { text: 'Known Limitations', link: '/security/known-limitations' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'PDA Seeds & Constants', link: '/reference/seeds' },
          { text: 'Instructions & Accounts', link: '/reference/instructions' },
          { text: 'Error Codes', link: '/reference/errors' },
          { text: 'Events', link: '/reference/events' },
        ],
      },
      {
        text: 'Development',
        items: [
          { text: 'Local Setup', link: '/development/local-setup' },
          { text: 'Testing', link: '/development/testing' },
          { text: 'Docs Toolchain', link: '/development/docs-toolchain' },
        ],
      },
      {
        text: 'Appendix',
        items: [{ text: 'LOI vs Code', link: '/appendix/loi-divergences' }],
      },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/:repo/edit/main/docs/:path',
      text: 'Edit this page',
    },
    footer: {
      message: 'Documentation for the Trana Anchor program.',
      copyright: 'Trana Protocol',
    },
    docFooter: { prev: 'Previous', next: 'Next' },
    socialLinks: [],
  },
})
