import { escapeHtml as e, jsonForHtml } from './html.ts'
import { supportUrl } from '../data/support.ts'
import { renderSiteFooter, renderSiteHeader } from '../views/home.ts'

const runtimeEnv = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
export const siteUrl = new URL(runtimeEnv.SITE_URL ?? 'https://metaprev.forsvn.com').origin
export const indexingEnabled = runtimeEnv.PUBLIC_INDEXING === 'on'
export const siteDescription = 'Check a public URL’s Open Graph tags, share image and metadata before you post. See representative previews and factual issues with Metaprev.'

export function page({ title, description = siteDescription, path = '/', body, privatePage = false, schema = [] }: {
  title: string; description?: string; path?: string; body: string; privatePage?: boolean; schema?: object[]
}): string {
  const canonical = new URL(path, siteUrl).href
  const graph = [
    { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: 'FORSVN', url: 'https://forsvn.com' },
    { '@type': 'WebSite', '@id': `${siteUrl}/#website`, name: 'Metaprev', url: siteUrl,
      publisher: { '@id': `${siteUrl}/#organization` } },
    { '@type': 'WebPage', '@id': canonical, url: canonical, name: title, description,
      isPartOf: { '@id': `${siteUrl}/#website` }, inLanguage: 'en' },
    ...(path === '/' ? [{ '@type': 'WebApplication', name: 'Metaprev', url: siteUrl,
      applicationCategory: 'DeveloperApplication', operatingSystem: 'Web browser',
      isAccessibleForFree: true, description: siteDescription }] : []),
    ...schema,
  ]
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="color-scheme" content="light"><meta name="theme-color" content="#f2f4ef"><meta name="robots" content="${privatePage || !indexingEnabled ? 'noindex, nofollow' : 'index, follow'}"><link rel="canonical" href="${e(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Metaprev"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${siteUrl}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Metaprev: check the preview before you share the link"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(description)}"><meta name="twitter:image" content="${siteUrl}/og.png"><link rel="icon" type="image/svg+xml" href="/mark.svg"><link rel="preload" href="/fonts/Archivo-normal-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/styles.css"><link rel="alternate" type="text/markdown" href="/index.md"><script type="application/ld+json">${jsonForHtml({ '@context': 'https://schema.org', '@graph': graph })}</script><script src="/app.js" defer></script></head><body>${body}</body></html>`
}

export function articleShell({ title, body, support = false }: { title: string; body: string; support?: boolean }): string {
  const callToAction = support && supportUrl ? `<aside class="guide-support" aria-labelledby="support-title"><h2 id="support-title">Did this guide help?</h2><p>You can support Hung’s work on tools like Metaprev. Support is voluntary. Metaprev stays free.</p><a href="${e(supportUrl)}" target="_blank" rel="noopener noreferrer">Support Hung on GitHub Sponsors ↗</a><p class="muted">Choose an amount on GitHub. This link opens a new tab.</p></aside>` : ''
  return `${renderSiteHeader()}<main id="main" class="article"><a class="back-link" href="/">← Check a URL</a><h1>${e(title)}</h1>${body}${callToAction}</main>${renderSiteFooter()}`
}
