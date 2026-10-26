// Real Chromium, intercepted HTTPS origin. No real publisher or ad impressions.
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { readAdsConfig, renderAds, advertisingCsp } from '../lib/ads.ts'
const origin = 'https://metaprev.forsvn.com'
const config = readAdsConfig({ SITE_URL: origin, ADS_ENABLED: 'on', ADS_OWNER_APPROVED: 'on', ADS_SITE_APPROVED: 'on', ADS_PRIVACY_REVIEWED: 'on', ADS_CMP_READY: 'on', ADS_CSP_REVIEWED: 'on', ADS_TXT_ENABLED: 'on', ADSENSE_CLIENT: 'ca-pub-1234567890123456', ADSENSE_SLOT: '1234567890' }, true)
const loader = await Bun.file(new URL('../public/ads.js', import.meta.url)).text()
const css = await Bun.file(new URL('../public/styles.css', import.meta.url)).text()
const adCss = await Bun.file(new URL('../public/ads.css', import.meta.url)).text()
const checks: { name: string; ok: boolean }[] = []
const check = (name: string, ok: boolean) => { checks.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const consent = { cmpStatus: 'loaded', eventStatus: 'tcloaded', gdprApplies: true, cmpId: 999, listenerId: 1, tcString: 'test-fixture-not-a-real-consent-string', vendor: { consents: { 755: true } }, purpose: { consents: Object.fromEntries([1, 2, 3, 4, 7, 9, 10].map(id => [id, true])) } }
declare global { interface Window { __testConsent: (data: object, success: boolean) => void; __networkLoads?: number; __privacyOpened?: boolean } }
const browser = await chromium.launch({ channel: 'chrome' })
try {
  for (const width of [320, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    let requests = 0
    let sdkFails = false
    let adapterRequests = 0
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) {
        requests++
        await route.fulfill({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'window.__networkLoads = (window.__networkLoads || 0) + 1;' + (sdkFails ? 'window.adsbygoogle={push(){throw new Error("test SDK failure")}};' : '') }); return
      }
      if (url.pathname === '/ads.js') { await route.fulfill({ contentType: 'text/javascript', body: loader }); return }
      if (url.pathname === '/ads.css') { await route.fulfill({ contentType: 'text/css', body: adCss }); return }
      if (url.pathname === '/styles.css') { await route.fulfill({ contentType: 'text/css', body: css }); return }
      if (url.pathname === '/ads-cmp.js') {
        adapterRequests++
        await route.fulfill({ contentType: 'text/javascript', body: `window.metaprevAdPrivacyChoices = () => { window.__privacyOpened = true }; window.__tcfapi = (command, version, callback) => { if (command === 'addEventListener') window.__testConsent = callback; };` }); return
      }
      const body = `<html><head><link rel="stylesheet" href="/styles.css"></head><body><main><h1>Original guide</h1><p>Useful guide content.</p></main>${renderAds(config, url.pathname)}</body></html>`
      const nonce = crypto.randomUUID()
      const csp = advertisingCsp(config, url.pathname, nonce)
      await route.fulfill({ contentType: 'text/html', headers: csp ? { 'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer' } : {}, body: body.replace(/<script\b/g, `<script nonce="${nonce}"`) })
    })
    await page.goto(origin + '/guides/og-image')
    await page.waitForFunction(() => typeof window.__testConsent === 'function')
    check(`${width}: no ad request before consent`, requests === 0)
    await page.evaluate(data => { const w = window; w.__testConsent(data, true); w.__testConsent(data, true) }, consent)
    await page.waitForFunction(() => window.__networkLoads === 1)
    check(`${width}: affirmative consent loads one script and one unit`, requests === 1 && await page.locator('.adsbygoogle').count() === 1)
    check(`${width}: no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.locator('[data-ad-privacy]').click()
    check(`${width}: privacy control opens actual adapter settings`, await page.evaluate(() => window.__privacyOpened === true))
    await page.evaluate(data => window.__testConsent({ ...data, eventStatus: 'cmpuishown' }, true), consent)
    check(`${width}: opening settings does not reload`, requests === 1)
    const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame())
    await page.evaluate(data => window.__testConsent({ ...data, eventStatus: 'useractioncomplete', vendor: { consents: { 755: false } } }, true), consent)
    await navigation
    await page.waitForLoadState('load')
    check(`${width}: revocation reloads and does not restart ads`, requests === 1 && new URL(page.url()).search === '?ads=off')
    check(`${width}: safe restart does not request CMP`, adapterRequests === 1)
    check(`${width}: ad-free fallback retains usable privacy entry`, await page.locator('[data-ad-privacy-link]').isVisible() && await page.locator('[data-ad-privacy-link]').getAttribute('href') === '/guides/og-image')
    await page.goto(origin + '/guides/og-image')
    await page.waitForFunction(() => typeof window.__testConsent === 'function')
    await page.evaluate(data => window.__testConsent(data, true), consent)
    await page.waitForFunction(() => window.__networkLoads === 1)
    const restored = page.waitForURL(url => url.search === '?ads=off')
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    await restored
    check(`${width}: BFCache restore terminates stale ad document`, new URL(page.url()).search === '?ads=off')
    sdkFails = true
    await page.goto(origin + '/guides/og-image')
    await page.waitForFunction(() => typeof window.__testConsent === 'function')
    const failedSdk = page.waitForURL(url => url.search === '?ads=off')
    await page.evaluate(data => window.__testConsent(data, true), consent)
    await failedSdk
    check(`${width}: SDK initialization error terminates document once`, new URL(page.url()).search === '?ads=off')
    sdkFails = false
    await page.screenshot({ path: `artifacts/ads-${width}.png`, fullPage: true })
    for (const [name, data, success] of [
      ['denied', { ...consent, vendor: { consents: { 755: false } } }, true],
      ['missing purpose', { ...consent, purpose: { consents: { 1: true } } }, true],
      ['region unknown', { ...consent, gdprApplies: undefined }, true],
      ['non-GDPR', { ...consent, gdprApplies: false }, true],
      ['callback failed', consent, false],
      ['missing string', { ...consent, tcString: '' }, true],
    ] as const) {
      await page.goto(origin + '/guides/og-image')
      await page.waitForFunction(() => typeof window.__testConsent === 'function')
      const before = requests
      await page.evaluate(({ data, success }) => window.__testConsent(data, success), { data, success })
      check(`${width}: ${name} stays off`, requests === before && await page.locator('[data-ad-container]:visible').count() === 0)
    }
    for (const path of ['/guides/og-image?url=private', '/guides/og-image#secret', '/', '/inspect', '/privacy']) {
      const before = adapterRequests
      await page.goto(origin + path)
      check(`${width}: ${path} never loads CMP or ads`, adapterRequests === before)
    }
    for (const suffix of ['?token=secret', '#secret']) {
      await page.goto(origin + '/guides/og-image')
      await page.waitForFunction(() => typeof window.__testConsent === 'function')
      const before = requests
      await page.evaluate(({ data, suffix }) => { history.replaceState(null, '', suffix); window.__testConsent(data, true) }, { data: consent, suffix })
      check(`${width}: location mutation ${suffix} while waiting keeps ads off`, requests === before)
    }
    await page.goto(origin + '/guides/og-image')
    await page.waitForFunction(() => typeof window.__testConsent === 'function')
    await page.clock.install()
    await page.clock.fastForward(10_001)
    const before = requests
    await page.evaluate(data => window.__testConsent(data, true), consent)
    check(`${width}: timeout rejects late consent`, requests === before)
    check(`${width}: no runtime errors`, errors.length === 0)
    await context.close()
  }
} finally { await browser.close() }
await mkdir('artifacts', { recursive: true })
await writeFile('artifacts/ads-browser.json', JSON.stringify({ checks, thirdPartyRequests: 'intercepted; test IDs only' }, null, 2))
if (checks.some(c => !c.ok)) process.exitCode = 1
