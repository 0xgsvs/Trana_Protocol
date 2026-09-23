import { defineConfig } from 'vitepress'
import { mermaid } from './plugins/mermaid.ts'
import { gruvboxShiki } from './theme/shiki.ts'

export default defineConfig({
  title: 'Parametric Risk Protocols',
  description:
    'Parametric risk protocols on Solana — district rainfall reinsurance and freight-delay indemnity. Anchor architecture, instructions, and workflows.',
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
    // One entry per protocol. The sidebar below is keyed by the same path
    // prefixes, so selecting a protocol swaps the whole left-hand tree.
    nav: [
      { text: 'Reinsurance', link: '/reinsurance/introduction/overview' },
      { text: 'Freight Delay', link: '/freight_delay/introduction/overview' },
    ],
    // Keyed by path prefix: VitePress picks the longest matching key, so every
    // page under `/reinsurance/` gets the Reinsurance tree and every page under `/freight_delay/`
    // gets the Freight Delay tree. The root landing page matches neither and shows no
    // sidebar.
    sidebar: {
      '/reinsurance/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Overview', link: '/reinsurance/introduction/overview' },
            { text: 'Actors & Roles', link: '/reinsurance/introduction/actors' },
            { text: 'Scope & Status', link: '/reinsurance/introduction/scope' },
          ],
        },
        {
          text: 'Protocol',
          items: [
            { text: 'Architecture', link: '/reinsurance/protocol/architecture' },
            { text: 'Accounts & State', link: '/reinsurance/protocol/accounts' },
            { text: 'Instructions', link: '/reinsurance/protocol/instructions' },
            { text: 'Invariants', link: '/reinsurance/protocol/invariants' },
            { text: 'Economics', link: '/reinsurance/protocol/economics' },
          ],
        },
        {
          text: 'Workflows',
          items: [
            { text: 'Pool Lifecycle', link: '/reinsurance/workflows/lifecycle' },
            { text: 'LP Capital', link: '/reinsurance/workflows/lp-capital' },
            { text: 'Policy Settlement', link: '/reinsurance/workflows/policy-settlement' },
          ],
        },
        {
          text: 'Security',
          items: [
            { text: 'Threat Model', link: '/reinsurance/security/threat-model' },
            { text: 'Known Limitations', link: '/reinsurance/security/known-limitations' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'PDA Seeds & Constants', link: '/reinsurance/reference/seeds' },
            { text: 'Instructions & Accounts', link: '/reinsurance/reference/instructions' },
            { text: 'Error Codes', link: '/reinsurance/reference/errors' },
            { text: 'Events', link: '/reinsurance/reference/events' },
          ],
        },
        {
          text: 'Development',
          items: [
            { text: 'Local Setup', link: '/reinsurance/development/local-setup' },
            { text: 'Testing', link: '/reinsurance/development/testing' },
            { text: 'Docs Toolchain', link: '/reinsurance/development/docs-toolchain' },
          ],
        },
        {
          text: 'Appendix',
          items: [{ text: 'LOI vs Code', link: '/reinsurance/appendix/loi-divergences' }],
        },
      ],
      '/freight_delay/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Overview', link: '/freight_delay/introduction/overview' },
            { text: 'Scope & Status', link: '/freight_delay/introduction/scope' },
          ],
        },
        {
          text: 'Protocol',
          items: [
            { text: 'Architecture', link: '/freight_delay/protocol/architecture' },
            { text: 'Accounts & State', link: '/freight_delay/protocol/accounts' },
            { text: 'Instructions', link: '/freight_delay/protocol/instructions' },
            { text: 'Invariants', link: '/freight_delay/protocol/invariants' },
          ],
        },
        {
          text: 'Workflows',
          items: [{ text: 'Pool Lifecycle', link: '/freight_delay/workflows/lifecycle' }],
        },
        {
          text: 'Reference',
          items: [
            { text: 'PDA Seeds & Constants', link: '/freight_delay/reference/seeds' },
            { text: 'Instructions & Accounts', link: '/freight_delay/reference/instructions' },
            { text: 'Error Codes', link: '/freight_delay/reference/errors' },
            { text: 'Events', link: '/freight_delay/reference/events' },
          ],
        },
        {
          text: 'Appendix',
          items: [{ text: 'LOI vs Code', link: '/freight_delay/appendix/loi-divergences' }],
        },
      ],
    },
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/:repo/edit/main/docs/:path',
      text: 'Edit this page',
    },
    footer: {
      message: 'Documentation for the Reinsurance and Freight Delay Anchor programs.',
      copyright: 'Parametric Risk Protocols',
    },
    docFooter: { prev: 'Previous', next: 'Next' },
    socialLinks: [],
  },
})
