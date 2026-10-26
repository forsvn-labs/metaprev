import { expect, test } from 'bun:test'
import { createInspector, readImage } from '../lib/inspect.ts'
import type { PublicResponse, fetchPublic } from '../lib/public-fetch.ts'
import { renderResult } from '../views/home.ts'
const png = new Uint8Array(await Bun.file(new URL('../public/og.png', import.meta.url)).arrayBuffer())
const tiny = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ioAAAAASUVORK5CYII=', 'base64'))
const htmlResponse = (html: string): PublicResponse => ({ url: 'https://example.com/final/page', status: 200, headers: { 'content-type': 'text/html' }, contentType: 'text/html', body: new TextEncoder().encode(html) })
const imageResponse = (url: string, body = png): PublicResponse => ({ url, status: 200, headers: {}, contentType: 'image/png', body })
const tags = '<meta property="og:image" content="/og.png"><meta name="twitter:image" content="/x.png">'

test('two distinct probes overlap, share one deadline, and show the correct opaque X asset', async () => {
  const started: string[] = []
  const signals: AbortSignal[] = []
  let release!: () => void
  const both = new Promise<void>(resolve => { release = resolve })
  const fetcher: typeof fetchPublic = async (url, options) => {
    signals.push(options.signal!)
    if (options.kind === 'html') return htmlResponse(tags)
    started.push(url)
    if (started.length === 2) release()
    await both
    return imageResponse(url, url.endsWith('/x.png') ? tiny : png)
  }
  const report = await createInspector(fetcher)('https://example.com')
  expect(started).toEqual(['https://example.com/og.png', 'https://example.com/x.png'])
  expect(new Set(signals).size).toBe(1)
  expect(report.image?.width).toBe(1200)
  expect(report.twitterImage?.width).toBe(1)
  expect(report.preview.twitterImage).not.toBe(report.preview.image)
  expect(readImage(report.preview.twitterImage!.split('=')[1]!)?.bytes).toEqual(tiny)
  const rendered = renderResult(report)
  expect(rendered).toContain(`src="${report.preview.twitterImage}"`)
  expect(rendered).toContain('1 × 1 px')
  expect(rendered).not.toContain('twitter:image not fetched')
  expect(rendered).not.toContain('src="https://example.com/x.png"')
  expect(report.coverage?.images).toBe('response-bytes-and-header-dimensions')
})

test('normalized same-image aliases share one fetch and one cache entry; no cross-request caching', async () => {
  let count = 0
  const inspect = createInspector(async (url, options) => {
    if (options.kind === 'html') return htmlResponse('<meta property="og:image" content="/same.png#og"><meta name="twitter:image" content="https://EXAMPLE.com:443/same.png#x">')
    count++
    return imageResponse(url)
  })
  const report = await inspect('https://example.com')
  expect(count).toBe(1)
  expect(report.preview.twitterImage).toBe(report.preview.image)
  expect(report.twitterImage?.width).toBe(1200)
  await inspect('https://example.com')
  expect(count).toBe(2)
})

test('failed X image cannot suppress OG evidence and gets scoped, bounded findings', async () => {
  const report = await createInspector(async (url, options) => {
    if (options.kind === 'html') return htmlResponse(tags)
    if (url.endsWith('/x.png')) throw new Error('upstream secret diagnostic')
    return imageResponse(url)
  })('https://example.com')
  expect(report.image?.ok).toBe(true)
  expect(report.twitterImage?.ok).toBe(false)
  const issue = report.issues.find(i => i.code === 'twitter-image-unverified')
  expect(issue?.field).toBe('twitter:image')
  expect(issue?.basis).toBe('observation')
  expect(issue?.evidence).not.toContain('secret')
  expect(report.preview.twitterImage).toBeNull()
})

test('X-only images work and unsafe overrides never reach the injected transport', async () => {
  const calls: string[] = []
  let metadata = '<meta name="twitter:image" content="/x.png">'
  const inspect = createInspector(async (url, options) => {
    if (options.kind === 'html') return htmlResponse(metadata)
    calls.push(url)
    return imageResponse(url)
  })
  const onlyX = await inspect('https://example.com')
  expect(onlyX.image).toBeUndefined()
  expect(onlyX.twitterImage?.ok).toBe(true)
  for (const url of ['http://127.0.0.1/private', 'file:///private', 'https://user:pass@example.com/x.png']) {
    metadata = `<meta name="twitter:image" content="${url}">`
    const report = await inspect('https://example.com')
    expect(report.twitterImage?.ok).toBe(false)
  }
  expect(calls).toEqual(['https://example.com/x.png'])
})

test('overall deadline aborts both image requests and preserves page metadata', async () => {
  let aborted = 0
  const report = await createInspector(async (_url, options) => {
    if (options.kind === 'html') return htmlResponse(tags)
    return new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => { aborted++; reject(new Error('deadline')) }, { once: true })
    })
  }, 20)('https://example.com')
  expect(aborted).toBe(2)
  expect(report.meta.twitterImage).toBe('/x.png')
  expect(report.image?.ok).toBe(false)
  expect(report.twitterImage?.ok).toBe(false)
})

test('video remains declared-only: no video/player requests, clear UI and JSON coverage', async () => {
  const calls: string[] = []
  const report = await createInspector(async (url) => {
    calls.push(url)
    return htmlResponse('<meta property="og:video" content="http://127.0.0.1/player"><meta property="og:video:type" content="text/html"><meta property="og:video:width" content="640"><meta property="og:video:height" content="360">')
  })('https://example.com')
  expect(calls).toHaveLength(1)
  expect(report.coverage?.video).toBe('declared-only')
  const rendered = renderResult(report)
  expect(rendered).toContain('Video: declared metadata only')
  expect(rendered).toContain('og:video:type')
  expect(rendered).not.toContain('<video')
  expect(rendered).not.toContain('<iframe')
})
