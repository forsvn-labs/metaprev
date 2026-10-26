// Offline acceptance for the failure modes in app/docs/messaging-surfaces.md.
// Runs the real web and CLI renderers. Never sends platform messages.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { renderHtml } from '../../app/src/render.ts'
import { messagingReport, hostileReport } from '../../app/test/fixtures/messaging.ts'
import { page as shell } from '../lib/page.ts'
import { renderHomeContent } from '../views/home.ts'
import type { WebReport } from '../lib/inspect.ts'

const out = process.env.OUT ?? '/tmp/metaprev-messaging-evidence'
await mkdir(out, { recursive: true })
const raster = new Uint8Array(await Bun.file(new URL('../public/og.png', import.meta.url)).arrayBuffer())
const dataUri = `data:image/png;base64,${Buffer.from(raster).toString('base64')}`
const asWeb = (hostile = false, missing = false): WebReport => ({
  ...(hostile ? hostileReport : messagingReport),
  image: missing ? undefined : { ...messagingReport.image!, dataUri },
  preview: { title: 'Open Graph title', description: 'Open Graph description',
    image: missing ? null : '/api/image?id=00000000-0000-0000-0000-000000000001', siteName: 'Example Notes', domain: 'example.com' },
  durationMs: 1,
})
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  const url = new URL(request.url)
  if (url.pathname === '/api/image') return new Response(raster, { headers: { 'Content-Type': 'image/png' } })
  if (['/styles.css', '/app.js', '/mark.svg'].includes(url.pathname) || url.pathname.startsWith('/fonts/')) return new Response(Bun.file(new URL(`../public${url.pathname}`, import.meta.url)))
  const report = asWeb(url.searchParams.has('hostile'), url.searchParams.has('missing'))
  if (url.pathname === '/cli') return new Response(renderHtml(report), { headers: { 'Content-Type': 'text/html' } })
  return new Response(shell({ title: 'Messaging fixture · Metaprev', body: renderHomeContent({ result: report }), privatePage: true }), { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': csp } })
} })
const base = `http://127.0.0.1:${server.port}`
const checks: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: string): void { checks.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const browser = await chromium.launch({ channel: 'chrome' })
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const tab = await context.newPage()
    const errors: string[] = []
    tab.on('pageerror', error => errors.push(error.message))
    for (const route of ['/', '/cli']) {
      await tab.goto(base + route, { waitUntil: 'networkidle' })
      const prefix = `${width} ${route}`
      check(`${prefix}: six messaging contexts`, await tab.locator('[data-messaging-surface]').count() === 6)
      check(`${prefix}: no horizontal overflow`, await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      check(`${prefix}: ordinary iMessage omits description`, await tab.locator('[data-messaging-surface=imessage] .messaging-card__description').count() === 0)
      check(`${prefix}: X Chat has no inferred card`, await tab.locator('[data-messaging-surface="x-chat"] .messaging-card').count() === 0)
      check(`${prefix}: X Chat uncertainty visible`, await tab.locator('[data-messaging-surface="x-chat"]').innerText().then(text => text.includes('Needs live verification')))
      const compact = tab.locator('[data-messaging-size]')
      await compact.locator('summary').focus()
      await compact.locator('summary').press('Enter')
      check(`${prefix}: keyboard opens compact comparison`, await compact.getAttribute('open') !== null && await compact.locator('.messaging-card--compact').isVisible())
      const disabled = tab.locator('[data-messaging-surface=whatsapp] [data-messaging-disabled]')
      await disabled.locator('summary').click()
      check(`${prefix}: suppressed preview retains URL`, await disabled.getByRole('link').isVisible())
      check(`${prefix}: external links preserve report`, await tab.locator('.messaging a').evaluateAll(links => links.every(link => link instanceof HTMLAnchorElement && link.target === '_blank' && link.rel.includes('noopener'))))
      check(`${prefix}: resources stay local`, await tab.evaluate(() => performance.getEntriesByType('resource').every(resource => new URL(resource.name).origin === location.origin)))
      if (route === '/') {
        check(`${prefix}: four feed tabs preserved`, await tab.getByRole('tab').count() === 4)
        await tab.getByRole('tab').first().press('End')
        check(`${prefix}: feed keyboard navigation`, await tab.getByRole('tab').last().getAttribute('aria-selected') === 'true')
        await tab.getByRole('button', { name: 'Dark', exact: true }).click()
        check(`${prefix}: messaging inherits dark appearance`, await tab.locator('.messaging-card').first().evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(36, 46, 58)')
      }
      if ([390, 1440].includes(width)) await tab.locator('.messaging').screenshot({ path: `${out}/${route === '/' ? 'web' : 'cli'}-${width}.png` })
    }
    await tab.goto(base + '/?hostile', { waitUntil: 'networkidle' })
    check(`${width}: hostile markup remains text`, await tab.locator('.messaging img[src=x], .messaging script, .messaging a[href^="javascript:"]').count() === 0)
    await tab.goto(base + '/?missing', { waitUntil: 'networkidle' })
    check(`${width}: missing image state`, await tab.locator('.messaging-card__empty').count() === 6)
    check(`${width}: no runtime errors`, errors.length === 0, errors.join('; '))
    await context.close()
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } })
  const tab = await context.newPage()
  await tab.goto(base, { waitUntil: 'networkidle' })
  check('no JS: six contexts visible', await tab.locator('[data-messaging-surface]:visible').count() === 6)
  await tab.locator('[data-messaging-size] summary').click()
  check('no JS: comparison works', await tab.locator('[data-messaging-size] .messaging-card').isVisible())
  await context.close()
  await writeFile(`${out}/results.json`, JSON.stringify({ fixture: 'illustrative, not live platform evidence', checks }, null, 2))
  await writeFile(`${out}/web-report.html`, shell({ title: 'Messaging fixture', body: renderHomeContent({ result: asWeb() }), privatePage: true }))
  await writeFile(`${out}/cli-report.html`, renderHtml(asWeb()))
} finally { await browser.close(); server.stop(true) }
console.log(`${checks.filter(check => check.ok).length}/${checks.length} passed; ${out}/results.json`)
process.exitCode = checks.some(check => !check.ok) ? 1 : 0
