// Real HTTP acceptance, written before the implementation. Start site on 4323.
// Live public input is deliberate: no fixture replaces an external fetch.
import { mkdir, writeFile } from 'node:fs/promises'
import { guides } from '../data/guides.ts'
import { imageSize } from 'image-size'

const base = process.env.BASE ?? 'http://127.0.0.1:4323'
const checks: { name: string; ok: boolean; detail?: unknown }[] = []
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
}
const compressed = await fetch(base + '/styles.css', { headers: { 'accept-encoding': 'gzip' } })
check('text assets use gzip when requested', compressed.headers.get('content-encoding') === 'gzip' && (await compressed.text()).includes(':root'))
const identity = await fetch(base + '/styles.css', { headers: { 'accept-encoding': 'gzip;q=0' } })
check('gzip quality zero stays uncompressed', !identity.headers.has('content-encoding'))
for (const path of ['/', '/guides', '/about', '/privacy', '/robots.txt', '/sitemap.xml', '/llms.txt']) {
  const response = await fetch(base + path)
  check(`${path}: available`, response.ok)
  if (path === '/') {
    const html = await response.text()
    check('server-rendered input and limits', html.includes('data-inspect-form') && html.includes('name="url"'))
    check('CSP prevents remote script execution', response.headers.get('content-security-policy')?.includes("script-src 'self'") === true)
  }
}
const guideBodies = []
const guideTitles = new Set<string>()
for (const guide of guides) {
  const path = `/guides/${guide.slug}`
  const response = await fetch(base + path)
  const html = await response.text()
  const title = /<title>(.*?)<\/title>/.exec(html)?.[1] ?? ''
  guideTitles.add(title)
  guideBodies.push(Bun.hash(html).toString())
  check(`${path}: useful server HTML and sample`, response.ok && html.includes(guide.answer) && html.includes('<pre><code>'))
  check(`${path}: canonical, article schema and source`, html.includes(`href="https://metaprev.forsvn.com${path}"`) && html.includes('TechArticle') && html.includes(guide.source.url))
  check(`${path}: hub and sibling navigation`, html.includes('href="/guides"') && guides.filter(g => g !== guide).every(g => html.includes(`/guides/${g.slug}`)))
}
check('guide titles and bodies are distinct', guideTitles.size === guides.length && new Set(guideBodies).size === guides.length)
const sitemap = await (await fetch(base + '/sitemap.xml')).text()
check('sitemap excludes inspected URLs', !sitemap.includes('/inspect') && guides.every(g => sitemap.includes(`/guides/${g.slug}`)))
const shareAsset = await fetch(base + '/og.png')
const shareImage = imageSize(new Uint8Array(await shareAsset.arrayBuffer()))
check('own share image is a valid 1200x630 PNG', shareAsset.ok && shareImage.type === 'png' && shareImage.width === 1200 && shareImage.height === 630)
for (const url of ['http://127.0.0.1', 'http://169.254.169.254/latest/meta-data', 'https://user:pass@example.com', 'javascript:alert(1)']) {
  const response = await fetch(base + '/api/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  const result = await response.json()
  check(`rejects unsafe URL ${url}`, response.status === 400 && result.ok === false)
  check('private response is no-store/noindex', response.headers.get('cache-control')?.includes('no-store') === true && response.headers.get('x-robots-tag')?.includes('noindex') === true)
}
const malformed = await fetch(base + '/api/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })
check('invalid JSON rejected', malformed.status === 400)
const crossSite = await fetch(base + '/api/inspect', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ url: 'https://forsvn.com' }) })
check('cross-site browser submission rejected', crossSite.status === 403)
const before = performance.now()
const live = await fetch(base + '/api/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://conquistador.app' }) })
const report = await live.json()
check('real public HTML metadata returned', live.ok && report.ok === true && report.report.meta.ogTitle?.includes('Conquistador'), report)
check('safe escaped result HTML returned', typeof report.html === 'string' && report.html.includes('data-results-content'))
check('request completes within bounded deadline', performance.now() - before < 22_000)
check('results are excluded from indexing', live.headers.get('x-robots-tag')?.includes('noindex') === true)
const invalidImage = await fetch(base + '/api/image?url=' + encodeURIComponent('http://127.0.0.1/image.png'))
check('image proxy repeats URL policy', invalidImage.status === 400)
const pathTraversal = await fetch(base + '/public/../../app/package.json')
check('source files are not exposed', pathTraversal.status === 404)
const out = process.env.OUT ?? 'artifacts/http'
await mkdir(out, { recursive: true })
await writeFile(`${out}/results.json`, JSON.stringify({ base, checks }, null, 2))
console.log(`${checks.filter(c => c.ok).length}/${checks.length} passed`)
process.exitCode = checks.some(c => !c.ok) ? 1 : 0
