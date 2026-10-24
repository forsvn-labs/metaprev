// Browser acceptance from the pre-implementation failure contract.
// Run against a real server; success input is fetched from the public Internet.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const base = process.env.BASE ?? 'http://127.0.0.1:4323'
const out = process.env.OUT ?? 'artifacts/browser'
const checks: { name: string; ok: boolean; detail?: unknown }[] = []
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
}
const browser = await chromium.launch({ channel: 'chrome' })
for (const width of [320, 390, 768, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base, { waitUntil: 'networkidle' })
  check(`${width}: one heading and input`, await page.locator('h1').count() === 1 && await page.locator('input[name=url]').count() === 1)
  check(`${width}: no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check(`${width}: no third-party runtime requests`, await page.evaluate(() => performance.getEntriesByType('resource').every(r => new URL(r.name).origin === location.origin)))
  if (width === 1440 || width === 390) {
    await page.locator('input[name=url]').fill('https://conquistador.app')
    const complete = page.waitForResponse(r => r.url().endsWith('/api/inspect') && r.request().method() === 'POST')
    await page.locator('form[data-inspect-form] button[type=submit]').click()
    const response = await complete
    check(`${width}: real inspection succeeds`, response.ok())
    await page.waitForSelector('[data-results-content]')
    check(`${width}: actual fetched title visible`, await page.locator('[data-results]').innerText().then(t => t.includes('Conquistador')))
    check(`${width}: four platform tabs`, await page.getByRole('tab').count() === 4)
    const xTab = page.getByRole('tab', { name: 'X', exact: true })
    await xTab.click()
    check(`${width}: X tab selected`, await xTab.getAttribute('aria-selected') === 'true')
    await xTab.press('ArrowRight')
    check(`${width}: arrow keys navigate tabs`, await xTab.getAttribute('aria-selected') === 'false')
    await page.getByRole('tab', { selected: true }).press('End')
    check(`${width}: End selects last tab`, await page.getByRole('tab').last().getAttribute('aria-selected') === 'true')
    await page.getByRole('tab', { selected: true }).press('Home')
    check(`${width}: Home selects first tab`, await page.getByRole('tab').first().getAttribute('aria-selected') === 'true')
    const metadata = await page.locator('[data-copy-source=metadata]').first().textContent()
    await page.locator('[data-copy=metadata]').first().click()
    await page.locator('[data-copy=metadata][data-state=copied]').first().waitFor()
    check(`${width}: metadata copy reaches clipboard`, await page.evaluate(() => navigator.clipboard.readText()) === metadata)
    const json = await page.locator('[data-copy-source=json]').first().textContent()
    await page.locator('[data-copy=json]').first().click()
    await page.locator('[data-copy=json][data-state=copied]').first().waitFor()
    check(`${width}: JSON copy reaches clipboard`, await page.evaluate(() => navigator.clipboard.readText()) === json)
    check(`${width}: result has no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    check(`${width}: fetched images stay same-origin`, await page.locator('[data-results] img').evaluateAll(images => images.every(img => img instanceof HTMLImageElement && new URL(img.src).origin === location.origin)))
    await page.locator('input[name=url]').fill('http://127.0.0.1')
    const rejected = page.waitForResponse(r => r.url().endsWith('/api/inspect') && r.request().method() === 'POST')
    await page.locator('form[data-inspect-form] button[type=submit]').click()
    check(`${width}: unsafe target is rejected`, (await rejected).status() === 400)
    await page.locator('[data-error]:visible').waitFor()
    check(`${width}: error is visible and input is marked`, (await page.locator('[data-error-text]').innerText()).length > 0 && await page.locator('input[name=url]').getAttribute('aria-invalid') === 'true')
  }
  await page.goto(base + '/guides/og-image')
  check(`${width}: guide answer and code rendered`, await page.locator('h1').count() === 1 && await page.locator('pre code').count() === 1)
  check(`${width}: guide has no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check(`${width}: external links preserve the site`, await page.locator('a[href^="https://"]').evaluateAll(links => links.every(link => link instanceof HTMLAnchorElement && link.target === '_blank' && link.rel.includes('noopener'))))
  check(`${width}: no runtime errors`, errors.length === 0, errors)
  await context.close()
}
const context = await browser.newContext({ javaScriptEnabled: false })
const page = await context.newPage()
await page.goto(base)
await page.locator('input[name=url]').fill('https://conquistador.app')
await Promise.all([page.waitForURL(url => url.pathname === '/inspect'), page.locator('form[data-inspect-form] button[type=submit]').click()])
check('no JavaScript: inspection works through HTML form', await page.locator('[data-results]').innerText().then(t => t.includes('Conquistador')), await page.locator('[data-error-text]').textContent())
check('no JavaScript: response stays noindex', await page.locator('meta[name=robots]').getAttribute('content') === 'noindex, nofollow')
await context.close()
await browser.close()
await mkdir(out, { recursive: true })
await writeFile(`${out}/results.json`, JSON.stringify({ base, checks }, null, 2))
console.log(`${checks.filter(c => c.ok).length}/${checks.length} passed`)
process.exitCode = checks.some(c => !c.ok) ? 1 : 0
