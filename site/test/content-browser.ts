// Repeatable acceptance artifact: local public pages and local editor discovery.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { guides } from '../data/guides.ts'
const base = process.env.BASE ?? 'http://127.0.0.1:4336'
const out = new URL('../artifacts/content-pilot/', import.meta.url)
await mkdir(out, { recursive: true })
const checks: { name: string; ok: boolean }[] = []
const check = (name: string, ok: boolean) => { checks.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const browser = await chromium.launch({ channel: 'chrome' })
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(base + '/guides')
    check(`${width}: all published guides`, await page.locator('.guide-card').count() === guides.length)
    for (const guide of guides) {
      await page.goto(base + '/guides/' + guide.slug)
      check(`${width}: ${guide.slug} readable without scripts`, await page.locator('h1').innerText() === guide.title)
      check(`${width}: ${guide.slug} no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      check(`${width}: ${guide.slug} review date`, (await page.locator('.updated').innerText()).includes(guide.reviewed))
      check(`${width}: ${guide.slug} support link`, await page.getByRole('link', { name: /Support Hung/ }).getAttribute('href') === 'https://github.com/sponsors/hungv47')
    }
    check(`${width}: public editor is absent`, (await page.goto(base + '/admin/'))?.status() === 404)
    await context.close()
  }
  const sitemap = await (await fetch(base + '/sitemap.xml')).text()
  check('sitemap contains all published guides', guides.every(g => sitemap.includes('/guides/' + g.slug)))
  const context = await browser.newContext()
  const editor = await context.newPage()
  const errors: string[] = []
  editor.on('pageerror', error => errors.push(error.message))
  await editor.goto('http://127.0.0.1:4340/admin/')
  await editor.getByRole('button', { name: 'Login' }).click()
  await editor.getByText('Metaprev content', { exact: true }).first().waitFor()
  await editor.getByText('Guides', { exact: true }).last().click()
  await editor.getByText(guides[0].title, { exact: false }).first().waitFor()
  check('local CMS loads the guide collection', errors.length === 0)
  const contentFile = new URL('../data/guides.json', import.meta.url)
  const original = await Bun.file(contentFile).text()
  try {
    const title = editor.locator('input[id^="title-field"]').first()
    await title.waitFor({ state: 'attached' })
    if (!await title.isVisible()) await editor.locator('[class*=SortableListItem]').first().getByRole('button').first().click()
    await title.fill('CMS save verification')
    await editor.getByRole('button', { name: 'Publish', exact: true }).click()
    await editor.getByText('Publish now', { exact: true }).click()
    await editor.getByText('Changes saved', { exact: false }).waitFor()
    const saved = await Bun.file(contentFile).json()
    check('CMS edits persist to the content file', saved.guides[0].title === 'CMS save verification')
  } finally { await Bun.write(contentFile, original) }

  await context.close()
} catch (error) {
  check('acceptance completed without an error', false)
  throw error
} finally {
  await browser.close()
  await Bun.write(new URL('results.json', out), JSON.stringify({ checkedAt: new Date().toISOString(), base, checks }, null, 2))
}
if (checks.some(c => !c.ok)) process.exit(1)
