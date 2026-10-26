import { AggregateAnalytics } from './lib/analytics.ts'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { adsConfig, adsTxt, advertisingCsp } from './lib/ads.ts'
import { compressResponse } from './lib/compress.ts'
import { guides } from './data/guides.ts'
import { escapeHtml as e } from './lib/html.ts'
import { inspectUrl, readImage } from './lib/inspect.ts'
import { InspectionError } from './lib/public-fetch.ts'
import { articleShell, indexingEnabled, page, siteDescription, siteUrl } from './lib/page.ts'
import { renderHomeContent, renderResult } from './views/home.ts'

const analytics = new AggregateAnalytics(process.env)
if (analytics.enabled) {
  const timer = setInterval(() => {
    const totals = analytics.drain()
    if (totals) console.info(JSON.stringify(totals))
  }, 60 * 60_000)
  timer.unref()
}
const publicDir = new URL('./public/', import.meta.url)
const inputSchema = z.object({ url: z.string().trim().min(1).max(2048) }).strict()
const privateHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  // Preserve the Origin of same-origin HTML form posts. `no-referrer` makes
  // Chromium send an opaque Origin for this navigation and breaks origin checks.
  // External destinations still receive no referrer.
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
}
const buckets = new Map<string, { count: number; until: number }>()
let active = 0
function consume(key: string): boolean {
  const now = Date.now()
  if (buckets.size >= 5000) for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id)
  const bucket = buckets.get(key)
  if (!bucket || bucket.until <= now) {
    if (!bucket && buckets.size >= 5000) return false
    buckets.set(key, { count: 1, until: now + 60_000 })
    return true
  }
  if (bucket.count >= 20) return false
  bucket.count++
  return true
}

function response(body: BodyInit | null, status = 200, headers: HeadersInit = {}): Response {
  const merged = new Headers(securityHeaders)
  if (!indexingEnabled) merged.set('X-Robots-Tag', 'noindex, nofollow')
  new Headers(headers).forEach((value, key) => merged.set(key, value))
  return new Response(body, { status, headers: merged })
}
const htmlResponse = (html: string, status = 200, privatePage = false, path = '/') => {
  const nonce = !privatePage && adsConfig.enabled ? randomBytes(24).toString('base64') : ''
  const csp = advertisingCsp(adsConfig, path, nonce)
  return response(csp ? html.replace(/<script\b/g, `<script nonce="${nonce}"`) : html, status,
    { 'Content-Type': 'text/html; charset=utf-8', ...(privatePage || csp ? privateHeaders : { 'Cache-Control': 'public, max-age=60' }),
      ...(csp ? { 'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer' } : {}) })
}
const jsonResponse = (data: unknown, status = 200) => response(JSON.stringify(data), status,
  { ...privateHeaders, 'Content-Type': 'application/json; charset=utf-8' })
const article = (title: string, content: string, path: string, description?: string, schema?: object[]) =>
  page({ title: `${title} · Metaprev`, description, path, body: articleShell({ title, body: content }), schema })

async function readInput(request: Request): Promise<z.infer<typeof inputSchema>> {
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > 4096) throw new InspectionError('The submitted URL is too long.', 413)
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  if (reader) {
    const deadline = setTimeout(() => { void reader.cancel() }, 5000)
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.length
        if (size > 4096) { await reader.cancel(); throw new InspectionError('The submitted URL is too long.', 413) }
        chunks.push(chunk.value)
      }
    } finally { clearTimeout(deadline) }
  }
  const body = Buffer.concat(chunks).toString('utf8')
  let value: unknown
  try {
    if (request.headers.get('content-type')?.startsWith('application/json')) value = JSON.parse(body)
    else if (request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) value = Object.fromEntries(new URLSearchParams(body))
    else throw new Error('unsupported')
  } catch { throw new InspectionError('Submit a URL as JSON or a form.', 400) }
  const parsed = inputSchema.safeParse(value)
  if (!parsed.success) throw new InspectionError('Enter one public URL, up to 2048 characters.', 400)
  return parsed.data
}

async function handleRequest(request: Request, server: Bun.Server<undefined>): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const isInspect = path === '/api/inspect' || path === '/inspect'
  if (isInspect) {
    const fail = (error: string, status: number, source = '') => path === '/api/inspect'
      ? jsonResponse({ ok: false, error }, status)
      : htmlResponse(page({ title: 'Check a URL · Metaprev', body: renderHomeContent({ error, url: source }), privatePage: true }), status, true)
    if (request.method !== 'POST') return response('Use POST to inspect a URL.', 405, { ...privateHeaders, Allow: 'POST' })
    const origin = request.headers.get('origin')
    if ((origin && origin !== url.origin && origin !== siteUrl) || request.headers.get('sec-fetch-site') === 'cross-site') {
      return fail('Open Metaprev to inspect a URL.', 403)
    }
    const key = server.requestIP(request)?.address ?? 'unknown'
    if (active >= 4 || !consume(key)) return fail('Please wait a minute before checking another URL.', 429)
    active++
    let source = ''
    try {
      const input = await readInput(request)
      source = input.url
      const report = await inspectUrl(source)
      if (path === '/api/inspect') return jsonResponse({ ok: true, report, html: renderResult(report) })
      return htmlResponse(page({ title: 'Your share preview · Metaprev', body: renderHomeContent({ result: report, url: source }), privatePage: true }), 200, true)
    } catch (error) {
      const safe = error instanceof InspectionError ? error : new InspectionError('This page could not be inspected. Try another public URL.')
      return fail(safe.message, safe.status, source)
    } finally { active-- }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return response('Method not allowed.', 405, { Allow: 'GET, HEAD' })
  if (path === '/healthz') return jsonResponse({ status: 'ok', advertisingEnabled: adsConfig.enabled })
  if (path === '/ads.txt') {
    const body = adsTxt(adsConfig)
    return response(request.method === 'HEAD' ? null : body ?? 'Advertising is not configured.\n', body ? 200 : 404,
      { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  }
  if (path === '/api/image') {
    const id = url.searchParams.get('id')
    if (!id || !/^[\da-f-]{36}$/.test(id)) return jsonResponse({ ok: false, error: 'An inspected image ID is required.' }, 400)
    const image = readImage(id)
    if (!image) return jsonResponse({ ok: false, error: 'This preview image expired. Inspect the URL again.' }, 404)
    return response(request.method === 'HEAD' ? null : Buffer.from(image.bytes), 200,
      { ...privateHeaders, 'Content-Type': image.type, 'Content-Length': String(image.bytes.length), 'Content-Disposition': 'inline' })
  }
  if (path === '/') return htmlResponse(page({ title: 'Metaprev — check your link before you share it', body: renderHomeContent({}) }))
  if (path === '/guides') return htmlResponse(article('Open Graph guides',
    `<p>Inspect the tags behind a share card, then fix the field that needs attention. Each guide answers a different metadata question.</p><div class="guide-grid">${guides.map(g => `<a class="guide-card" href="/guides/${g.slug}"><code>${e(g.field)}</code><h2>${e(g.title)}</h2><p>${e(g.intent)}</p></a>`).join('')}</div>`, path,
    'Practical Open Graph guides for share images, titles, descriptions and canonical URLs. Check real metadata and fix the field behind the problem.'))
  const guide = guides.find(g => path === `/guides/${g.slug}`)
  if (guide) return htmlResponse(article(guide.title,
    `<p class="updated">Reviewed ${e(guide.reviewed ?? '2026-10-24')} · FORSVN</p><p>${e(guide.answer)}</p><h2>What to check</h2><ol>${guide.checks.map(c => `<li>${e(c)}</li>`).join('')}</ol><h2>Example metadata</h2><p>Replace the example URLs and copy with your page’s actual values.</p><pre><code>${e(guide.example)}</code></pre><h2>What a preview can tell you</h2><p>${e(guide.limitation)}</p><h2>Source</h2><p><a href="${e(guide.source.url)}" target="_blank" rel="noopener noreferrer">${e(guide.source.name)} ↗</a>. Source checked ${e(guide.reviewed ?? '2026-10-24')}.</p><p class="guide-cta"><a href="/">Check your URL with Metaprev →</a></p><h2>Related checks</h2><ul>${guides.filter(g => g !== guide).map(g => `<li><a href="/guides/${g.slug}">${e(g.title)}</a></li>`).join('')}</ul><p><a href="/guides">All Open Graph guides</a></p>`, path, guide.description,
    [{ '@type': 'TechArticle', headline: guide.title, description: guide.description, dateModified: guide.reviewed ?? '2026-10-24', author: { '@type': 'Organization', name: 'FORSVN', url: 'https://forsvn.com' }, mainEntityOfPage: `${siteUrl}${path}` },
     { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Metaprev', item: siteUrl }, { '@type': 'ListItem', position: 2, name: 'Guides', item: `${siteUrl}/guides` }, { '@type': 'ListItem', position: 3, name: guide.field, item: `${siteUrl}${path}` }] }]), 200, false, path)
  if (path === '/about') return htmlResponse(article('About Metaprev',
    `<p>Metaprev helps developers and content authors catch broken share metadata before posting a link. It is a FORSVN project.</p><h2>How the web inspector works</h2><p>Enter a public HTTP or HTTPS URL. The server fetches its HTML head and selected share image, parses Open Graph and X tags with the same parser as the local CLI, then returns observed metadata and representative cards.</p><p>No page scripts run. Pages that need a login, private network, browser session or JavaScript-rendered metadata are outside this web inspection. A preview cannot reproduce a platform’s private renderer or clear its cache.</p><h2>Use the local CLI</h2><pre><code>npx @forsvn/metaprev https://example.com</code></pre><p>The CLI requires Bun and can inspect local development pages on your machine. Its existing repair workspace includes additional crop and fallback tools.</p><p><a href="https://github.com/forsvn-labs/metaprev" target="_blank" rel="noopener noreferrer">Read the source and CLI instructions ↗</a>. The CLI is MIT licensed.</p><h2>Contact</h2><p><a href="mailto:hi@hungv47.com">hi@hungv47.com</a></p>`, path))
  if (path === '/privacy') return htmlResponse(article('Privacy and inspection limits',
    `<p class="updated">Implementation reviewed 24 October 2026</p><p>The web inspector sends your submitted URL to the Metaprev server so it can fetch the page and image. Use a public URL. Do not submit passwords, access tokens, signed links or other secrets in a URL.</p><h2>Data handled by this application</h2><ul><li>Submitted URLs and reports are processed for the current request. This application does not save a report database, browser history or local-storage history.</li><li>Verified image bytes stay in a bounded memory cache for up to five minutes so your browser can display the checked asset. Image IDs are random and expire; results are not public search pages.</li><li>A short-lived in-memory counter uses the connecting IP address to limit requests. Reverse proxies may present a shared IP.</li><li>Advertising is disabled by default. If enabled after review, individual public guides may load Google AdSense only after an affirmative signal from the configured certified consent platform. The inspector, reports and submitted URLs remain ad-free. Guide visitors can reopen advertising privacy choices next to the slot. The consent platform may store choices; Google may use cookies and process device and advertising data under the reviewed policy. This source change supplies no publisher account or consent platform.</li><li>No external analytics service or tracking pixels are configured. Optional server analytics are off by default. When the owner activates them, the server emits hourly counts and response-time buckets for fixed public pages only. It excludes inspection routes, query strings, DNT and Global Privacy Control requests, and does not collect visitor identifiers, cookies, referrers or report contents. Counts include bots and are not unique visitors. Host log retention must be reviewed before activation. Fonts are served by this application. An activated ad provider may make its own measurement requests under the reviewed advertising policy.</li></ul><h2>What other systems can observe</h2><p>The target website receives a request from the inspection server. Your browser connects to the Metaprev host. The eventual hosting provider may keep its own operational access logs under its settings; this source code does not establish that provider’s retention policy.</p><h2>Limits</h2><p>The web service accepts public HTTP and HTTPS pages on their standard ports, follows up to four redirects, reads up to 512 KB of HTML, and checks PNG, JPEG, WebP or GIF images up to 5 MB. Private networks and credentials are rejected. Network deadlines and request limits keep each inspection bounded.</p><p>Use the local CLI for private development URLs and additional local repair tools. Contact <a href="mailto:hi@hungv47.com">hi@hungv47.com</a> about this application.</p>`, path))
  if (path === '/robots.txt') return response(`User-agent: *\n${indexingEnabled ? 'Allow: /\nDisallow: /api/\nDisallow: /inspect' : 'Disallow: /'}\nSitemap: ${siteUrl}/sitemap.xml\n`, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
  if (path === '/sitemap.xml') return response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/guides', '/about', '/privacy', ...guides.map(g => `/guides/${g.slug}`)].map(p => `<url><loc>${e(siteUrl + p)}</loc><lastmod>${guides.find(g => p === `/guides/${g.slug}`)?.reviewed ?? (p === '/' || p === '/guides' || p === '/privacy' ? '2026-10-26' : '2026-10-24')}</lastmod></url>`).join('')}</urlset>`, 200, { 'Content-Type': 'application/xml; charset=utf-8' })
  if (path === '/llms.txt' || path === '/index.md') return response(`# Metaprev\n\n> ${siteDescription}\n\nMetaprev is a FORSVN URL metadata inspector. The web version fetches public HTML and verified raster images; the local MIT CLI supports development URLs and a repair workspace. Cards are representative, not guarantees of platform rendering.\n\n## Pages\n\n- [Check a URL](${siteUrl}/)\n- [About and limitations](${siteUrl}/about)\n- [Privacy](${siteUrl}/privacy)\n- [Source and CLI](https://github.com/forsvn-labs/metaprev)\n\n## Open Graph guides\n\n${guides.map(g => `- [${g.title}](${siteUrl}/guides/${g.slug}): ${g.answer}`).join('\n')}\n`, 200, { 'Content-Type': path.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8' })
  const staticFiles = new Set(['/styles.css', '/app.js', '/ads.js', '/ads.css', '/mark.svg', '/og.png', '/og.svg', '/fonts/OFL.txt'])
  if (adsConfig.enabled) staticFiles.add('/ads-cmp.js')
  if (staticFiles.has(path) || /^\/fonts\/[A-Za-z0-9-]+\.woff2$/.test(path)) {
    const file = Bun.file(new URL(path.slice(1), publicDir))
    if (await file.exists()) return response(request.method === 'HEAD' ? null : file, 200,
      { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=3600' })
  }
  return htmlResponse(article('Page not found', '<p>This page is not available. <a href="/">Check a URL</a> or open the <a href="/guides">Open Graph guides</a>.</p>', path), 404, true)
}

const server = Bun.serve({
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 4323),
  maxRequestBodySize: 4096,
  idleTimeout: 30,
  async fetch(request, server) {
    const started = performance.now()
    const result = await handleRequest(request, server)
    analytics.record(request, result.status, performance.now() - started)
    return compressResponse(result, request)
  },
  error() { return jsonResponse({ ok: false, error: 'The request could not be processed.' }, 500) },
})
console.info(`Metaprev ready at ${server.url}`)
