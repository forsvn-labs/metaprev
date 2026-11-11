// Failure modes: cache rejection must not turn a verified image into an upstream
// fetch failure; invalid image bytes must still fail; concurrent reports stay apart.
import { expect, test } from 'bun:test'
import { inspectWith } from '../lib/inspect-core.ts'
const png = new Uint8Array(await Bun.file(new URL('../public/og.png', import.meta.url)).arrayBuffer())
const fetchPage = async (url: string, {kind}: {kind: 'html'|'image'}) => ({
  url, status: 200, headers: {}, contentType: kind === 'html' ? 'text/html' : 'image/png',
  body: kind === 'html' ? new TextEncoder().encode(`<head><meta property="og:title" content="${new URL(url).hostname}"><meta property="og:image" content="/og.png"></head>`) : png,
})
test('cache outage preserves verified image facts and page findings', async () => {
  const report = await inspectWith('https://example.com', fetchPage, async () => { throw Error('private cache error') })
  expect(report.image?.ok).toBe(true)
  expect(report.image?.width).toBeGreaterThan(0)
  expect(report.preview.image).toBeNull()
  expect(JSON.stringify(report)).not.toContain('private cache error')
})
test('corrupt image remains a failed probe', async () => {
  const report = await inspectWith('https://example.com', async (url, options) => ({...await fetchPage(url, options), ...(options.kind === 'image' ? {body: new Uint8Array([1, 2, 3])} : {})}), () => { throw Error('must not store') })
  expect(report.image?.ok).toBe(false)
  expect(report.preview.image).toBeNull()
})
test('concurrent cache success and failure cannot overwrite another report', async () => {
  const [a,b] = await Promise.all([
    inspectWith('https://example.com', fetchPage, async () => { await Bun.sleep(10); return '/api/image?id=a' }),
    inspectWith('https://example.org', fetchPage, async () => { throw Error('cache down') }),
  ])
  expect(a.preview.image).toBe('/api/image?id=a')
  expect(b.preview.image).toBeNull()
  expect(a.meta.ogTitle).toBe('example.com')
  expect(b.meta.ogTitle).toBe('example.org')
  expect(b.image?.ok).toBe(true)
})
