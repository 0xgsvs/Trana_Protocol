#!/usr/bin/env bun
/**
 * Asserts that every ```mermaid block on every page actually renders to an
 * <svg> in a real browser.
 *
 * This is an integration check, not a unit test: syntax validation and markup
 * assertions both pass while the page still shows raw diagram source, which is
 * exactly the failure this catches.
 *
 * Usage:
 *   bun run dev            # or: bun run preview
 *   bun run test:render    # checks DOCS_URL, default http://localhost:5173
 *
 * On Linux/Windows, point Bun at a Chrome/Chromium binary if it is not on PATH:
 *   BUN_CHROME_PATH=/path/to/chromium bun run test:render
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.argv[2] ?? process.env.DOCS_URL ?? 'http://localhost:5173'
const DOCS = resolve(import.meta.dirname, '..')
const TIMEOUT_MS = 15_000
const POLL_MS = 150

/** Pages to check, taken from the site's own nav + sidebar. */
function pagesFromConfig() {
  const config = readFileSync(resolve(DOCS, '.vitepress/config.mts'), 'utf8')
  const links = [...config.matchAll(/link:\s*'([^']+)'/g)].map((match) => match[1])
  return [...new Set(links)]
}

/**
 * Wait until the page has mounted and every diagram it contains has rendered.
 *
 * Pages without diagrams return as soon as their content is mounted, so the
 * check does not pay the full timeout on 17 of 22 pages.
 */
async function waitForDiagrams(view) {
  const deadline = Date.now() + TIMEOUT_MS
  let state = { mounted: false, blocks: 0, rendered: 0 }

  while (Date.now() < deadline) {
    state = await view.evaluate(`(function () {
      const blocks = document.querySelectorAll('pre.mermaid');
      return {
        mounted: !!document.querySelector('.vp-doc'),
        blocks: blocks.length,
        rendered: document.querySelectorAll('pre.mermaid svg').length,
      };
    })()`)

    if (state.mounted && (state.blocks === 0 || state.rendered >= state.blocks)) {
      return state
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
  return state
}

const pages = pagesFromConfig()
const failures = []
const skipped = []
let totalDiagrams = 0

// Preflight so a missing server is an actionable message, not a wall of
// navigation errors.
try {
  const response = await fetch(BASE, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
} catch (error) {
  console.error(
    `Cannot reach ${BASE} — start the site first:\n` +
      `  bun run dev        # dev server, http://localhost:5173\n` +
      `  bun run preview    # or serve the production build\n\n` +
      `(${String(error.message ?? error).split('\n')[0]})`,
  )
  process.exit(2)
}

for (const page of pages) {
  const url = `${BASE}${page}`
  let result
  try {
    await using view = new Bun.WebView({ width: 1440, height: 1000 })
    await view.navigate(url)
    result = await waitForDiagrams(view)
  } catch (error) {
    failures.push({ page, error: String(error.message ?? error).split('\n')[0] })
    continue
  }

  if (result.blocks === 0) {
    skipped.push(page)
    continue
  }
  totalDiagrams += result.blocks
  if (result.rendered < result.blocks) {
    failures.push({
      page,
      error: `${result.rendered}/${result.blocks} diagrams rendered`,
    })
  } else {
    console.log(`ok  ${page.padEnd(36)} ${result.rendered}/${result.blocks}`)
  }
}

console.log(
  `\n${pages.length} pages checked, ${totalDiagrams} diagrams, ` +
    `${skipped.length} pages without diagrams, ${failures.length} failing`,
)

if (failures.length > 0) {
  console.error('\nFAILURES')
  for (const failure of failures) console.error(`  ${failure.page}: ${failure.error}`)
  process.exit(1)
}
