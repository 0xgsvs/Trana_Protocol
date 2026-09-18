import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** Shared discovery for the docs tests, so the suites agree on what a page is. */

export const DOCS = resolve(import.meta.dirname, '..')
export const CONFIG_PATH = join(DOCS, '.vitepress/config.mts')
export const config = readFileSync(CONFIG_PATH, 'utf8')

/** Glob subset covering `srcExclude`; the globstar matches zero or more segments. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const pattern = escaped.replace(/\*\*\//g, '(?:.*/)?').replace(/\*/g, '[^/]*')
  return new RegExp(`^${pattern}$`)
}

/**
 * Patterns the site excludes from its source tree. Read from the config rather
 * than hard-coded, so a page excluded from the build is not reported as an
 * unreachable page.
 */
export const srcExclude: RegExp[] = (() => {
  const block = /srcExclude:\s*\[([^\]]*)\]/.exec(config)
  if (!block) return []
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => globToRegExp(match[1]))
})()

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'cache') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, acc)
    } else if (entry.endsWith('.md')) {
      acc.push(full)
    }
  }
  return acc
}

/** Markdown files the site actually builds, as docs-relative POSIX paths. */
export function sitePages(): string[] {
  return walk(DOCS)
    .map((file) => relative(DOCS, file).replaceAll('\\', '/'))
    .filter((page) => !srcExclude.some((pattern) => pattern.test(page)))
    .sort()
}

/** Every nav + sidebar link target, as written in the config. */
export function linkedPages(): string[] {
  return [...config.matchAll(/link:\s*'([^']+)'/g)].map((match) => match[1])
}

/** Sidebar-only link targets, as written in the config. */
export function sidebarPages(): string[] {
  const start = config.indexOf('sidebar: [')
  const block = config.slice(start, config.indexOf('search: {', start))
  return [...block.matchAll(/link:\s*'([^']+)'/g)].map((match) => match[1])
}

/** `/protocol/architecture` -> `protocol/architecture.md` */
export function linkToPage(link: string): string {
  return `${link.replace(/^\//, '')}.md`
}
