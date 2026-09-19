import { describe, expect, test } from 'bun:test'
import { parseMeta } from '../src/parse.ts'
import { resolvePrimaryInput, resolvePlatformInput, isKnownTwitterCard, CARD_SUMMARY, CARD_SUMMARY_LARGE_IMAGE } from '../src/inputs.ts'
import { buildAgentPrompt, buildMetaSnippet, buildFindingsText, buildRepairBrief, resolveInputs } from '../src/repair.ts'
import { classifyHost, classifyUrlHost } from '../src/host.ts'
import { readCappedBytes } from '../src/fetch.ts'
import { renderHtml } from '../src/render.ts'
import type { ImageProbe, MetaTags, Report } from '../src/types.ts'
import { validate } from '../src/validate.ts'

function report(over: Partial<Report>): Report {
  return {
    source: 'http://x',
    fetchedAt: '2026-01-01T00:00:00Z',
    finalUrl: 'http://x/',
    status: 200,
    meta: {},
    image: undefined,
    issues: [],
    ...over,
  }
}

function okImage(over: Partial<ImageProbe> = {}): ImageProbe {
  return { url: 'https://x/og.png', resolved: 'https://x/og.png', status: 200, ok: true, contentType: 'image/png', byteLength: 50_000, width: 1200, height: 630, ...over }
}

describe('parseMeta', () => {
  test('extracts title, og:*, twitter:*, and canonical', () => {
    const m = parseMeta(`<head>
      <title>Page Title</title>
      <meta property="og:title" content="OG Title">
      <meta property="og:type" content="website">
      <meta property="og:description" content="OG desc">
      <meta property="og:image" content="https://x/og.png">
      <meta property="og:image:alt" content="A quiet blue card">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:image" content="https://x/tw.png">
      <meta name="twitter:image:alt" content="An X-specific crop">
      <link rel="canonical" href="https://x/canonical">
    </head>`)
    expect(m.title).toBe('Page Title')
    expect(m.ogTitle).toBe('OG Title')
    expect(m.ogType).toBe('website')
    expect(m.ogImage).toBe('https://x/og.png')
    expect(m.ogImageAlt).toBe('A quiet blue card')
    expect(m.twitterCard).toBe('summary_large_image')
    expect(m.twitterImage).toBe('https://x/tw.png')
    expect(m.twitterImageAlt).toBe('An X-specific crop')
    expect(m.canonical).toBe('https://x/canonical')
  })

  test('decodes named, numeric, and hex entities; char count reflects decoded length', () => {
    const m = parseMeta(`<head><meta property="og:title" content="Ben &amp; Jerry&#8217;s &mdash; &#x2764;"></head>`)
    expect(m.ogTitle).toBe("Ben & Jerry’s — ❤")
    // 13 + " — ❤" = "Ben & Jerry's — ❤" is 17 code units; the point is it is NOT the
    // raw-entity length (which would be much longer).
    expect(m.ogTitle!.length).toBeLessThan(20)
    expect(m.ogTitle).not.toContain('&#')
    expect(m.ogTitle).not.toContain('&amp;')
  })

  test('leaves unknown / malformed entities untouched', () => {
    const m = parseMeta(`<head><meta property="og:title" content="100% &notreal; &#999999999;"></head>`)
    expect(m.ogTitle).toContain('&notreal;')
    expect(m.ogTitle).toContain('100%')
  })

  test('entity names that collide with Object.prototype do not leak prototype members', () => {
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
      const m = parseMeta(`<head><meta property="og:title" content="&${name};"></head>`)
      expect(m.ogTitle).toBe(`&${name};`)
    }
  })

  test('handles single quotes and unquoted attributes', () => {
    const m = parseMeta(`<head><meta property='og:title' content='  Single  '><meta property=og:description content=Bare></head>`)
    expect(m.ogTitle).toBe('Single')
    expect(m.ogDescription).toBe('Bare')
  })

  test('first og:image wins; og:image:secure_url is an alias', () => {
    const m = parseMeta(`<head><meta property="og:image" content="https://x/a.png"><meta property="og:image:secure_url" content="https://x/b.png"></head>`)
    expect(m.ogImage).toBe('https://x/a.png')
  })

  test('keeps structured properties attached to the selected first image', () => {
    const m = parseMeta(`<head>
      <meta property="og:image" content="https://x/first.png">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      <meta property="og:image:alt" content="First asset">
      <meta property="og:image" content="https://x/second.png">
      <meta property="og:image:width" content="400">
      <meta property="og:image:height" content="400">
      <link rel="alternate canonical" href="https://x/canonical">
    </head>`)
    expect(m.ogImage).toBe('https://x/first.png')
    expect(m.ogImageWidth).toBe('1200')
    expect(m.ogImageHeight).toBe('630')
    expect(m.ogImageAlt).toBe('First asset')
    expect(m.canonical).toBe('https://x/canonical')
  })

  test('attaches structured properties declared before the first og:image root tag', () => {
    const m = parseMeta(`<head>
      <meta property="og:image:alt" content="Early alt">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="630">
      <meta property="og:image" content="https://x/first.png">
    </head>`)
    expect(m.ogImage).toBe('https://x/first.png')
    expect(m.ogImageAlt).toBe('Early alt')
    expect(m.ogImageWidth).toBe('1200')
    expect(m.ogImageHeight).toBe('630')
  })

  test('a later og:image:url alias group does not steal structured props for the first image', () => {
    const m = parseMeta(`<head>
      <meta property="og:image" content="https://x/a.png">
      <meta property="og:image:url" content="https://x/b.png">
      <meta property="og:image:width" content="99">
    </head>`)
    expect(m.ogImage).toBe('https://x/a.png')
    // The width belongs to the b.png group, which the preview does not select.
    expect(m.ogImageWidth).toBeUndefined()
  })
})

describe('host classification', () => {
  test('classifies loopback, dev names, and unspecified hosts as local/non-public', () => {
    expect(classifyHost('localhost')).toBe('local')
    expect(classifyHost('app.localhost')).toBe('local')
    expect(classifyHost('shop.test')).toBe('local')
    expect(classifyHost('127.0.0.1')).toBe('loopback')
    expect(classifyHost('127.8.8.8')).toBe('loopback')
    expect(classifyHost('0.0.0.0')).toBe('unspecified')
    expect(classifyHost('::1')).toBe('loopback')
  })

  test('classifies IPv4-mapped IPv6 addresses by their embedded IPv4 range', () => {
    expect(classifyHost('::ffff:127.0.0.1')).toBe('loopback')
    expect(classifyHost('::ffff:10.0.0.5')).toBe('private')
    expect(classifyHost('::ffff:192.168.1.1')).toBe('private')
    expect(classifyHost('::ffff:8.8.8.8')).toBe('public')
    expect(classifyHost('::ffff:a00:1')).toBe('private') // ::ffff:10.0.0.1 in hex form
  })

  test('classifies CGNAT and other non-public IPv4 ranges', () => {
    expect(classifyHost('100.64.0.1')).toBe('private')
    expect(classifyHost('100.127.255.254')).toBe('private')
    expect(classifyHost('100.128.0.1')).toBe('public')
    expect(classifyHost('10.1.2.3')).toBe('private')
    expect(classifyHost('172.16.0.9')).toBe('private')
    expect(classifyHost('172.32.0.9')).toBe('public')
    expect(classifyHost('192.168.0.1')).toBe('private')
    expect(classifyHost('169.254.1.1')).toBe('private')
    expect(classifyHost('198.51.100.7')).toBe('reserved')
    expect(classifyHost('203.0.113.9')).toBe('reserved')
    expect(classifyHost('224.0.0.1')).toBe('reserved')
    expect(classifyHost('250.1.2.3')).toBe('reserved')
    expect(classifyHost('8.8.8.8')).toBe('public')
    expect(classifyHost('140.82.121.4')).toBe('public')
  })

  test('classifies IPv6 private and reserved ranges', () => {
    expect(classifyHost('fd00::1')).toBe('private')
    expect(classifyHost('fe80::1')).toBe('private')
    expect(classifyHost('ff02::1')).toBe('reserved')
    expect(classifyHost('2001:db8::1')).toBe('reserved')
    expect(classifyHost('2606:4700::6810:84e5')).toBe('public')
  })

  test('exposes two policies from one classifier', () => {
    expect(classifyUrlHost('http://localhost:3000/page').isLocalDevHost).toBe(true)
    expect(classifyUrlHost('http://127.0.0.1:3000').isLocalDevHost).toBe(true)
    expect(classifyUrlHost('http://localhost:3000/page').isPublicHost).toBe(false)
    expect(classifyUrlHost('https://hungv.io').isPublicHost).toBe(true)
    // A mapped-IPv6 private host is neither local-dev nor public.
    expect(classifyUrlHost('http://[::ffff:10.0.0.1]/').isLocalDevHost).toBe(false)
    expect(classifyUrlHost('http://[::ffff:10.0.0.1]/').isPublicHost).toBe(false)
    // Malformed input fails closed.
    expect(classifyUrlHost('not a url').isPublicHost).toBe(false)
  })
})

describe('bounded null-body reads', () => {
  function nullBodyResponse(headers: Record<string, string>, body?: ArrayBuffer): Response {
    return { body: null, headers: new Headers(headers), arrayBuffer: async () => body ?? new ArrayBuffer(0) } as unknown as Response
  }

  test('reads a small declared null-body response within the cap', async () => {
    const data = new TextEncoder().encode('hello').buffer as ArrayBuffer
    const { bytes, truncated } = await readCappedBytes(nullBodyResponse({ 'content-length': '5' }, data), 1024)
    expect(bytes.toString()).toBe('hello')
    expect(truncated).toBe(false)
  })

  test('rejects a null-body response whose declared length exceeds the cap', async () => {
    await expect(readCappedBytes(nullBodyResponse({ 'content-length': String(10 * 1024 * 1024) }), 1024))
      .rejects.toThrow('readable size limit')
  })

  test('rejects a null-body response with no declared length instead of reading unbounded', async () => {
    await expect(readCappedBytes(nullBodyResponse({}), 1024)).rejects.toThrow('readable size limit')
  })
})

describe('canonical input fallback policy', () => {
  test('Open Graph text never falls back to twitter:* copy', () => {
    const m = { twitterTitle: 'X only', twitterDescription: 'X only desc' }
    expect(resolvePlatformInput(m, 'Open Graph', 'title')).toMatchObject({ value: undefined, source: 'none', fallback: true })
    expect(resolvePlatformInput(m, 'X', 'title')).toMatchObject({ value: 'X only', source: 'twitter:title' })
    expect(resolvePlatformInput(m, 'X', 'description')).toMatchObject({ value: 'X only desc', source: 'twitter:description' })
  })

  test('platform precedence: OG uses og then page; X uses twitter then og then page', () => {
    const m = { title: 'Page', ogTitle: 'OG', twitterTitle: 'TW' }
    expect(resolvePlatformInput(m, 'Open Graph', 'title')).toMatchObject({ value: 'OG', source: 'og:title', fallback: false })
    expect(resolvePlatformInput(m, 'X', 'title')).toMatchObject({ value: 'TW', source: 'twitter:title', fallback: false })
    const noOg = { title: 'Page', twitterTitle: 'TW' }
    expect(resolvePlatformInput(noOg, 'X', 'title')).toMatchObject({ value: 'TW', source: 'twitter:title', fallback: false })
    const noTwitter = { title: 'Page', ogTitle: 'OG' }
    expect(resolvePlatformInput(noTwitter, 'X', 'title')).toMatchObject({ value: 'OG', source: 'og:title', fallback: true })
    expect(resolvePlatformInput(noTwitter, 'X', 'title').fallback).toBe(true)
  })

  test('primary display copy prefers og, then twitter, then page-level tags', () => {
    expect(resolvePrimaryInput({ title: 'P', twitterTitle: 'T', ogTitle: 'O' }, 'title')).toMatchObject({ value: 'O', source: 'og:title' })
    expect(resolvePrimaryInput({ title: 'P', twitterTitle: 'T' }, 'title')).toMatchObject({ value: 'T', source: 'twitter:title' })
    expect(resolvePrimaryInput({ title: 'P' }, 'title')).toMatchObject({ value: 'P', source: '<title>', fallback: true })
    expect(resolvePrimaryInput({}, 'title')).toMatchObject({ value: undefined, source: 'none' })
    expect(resolvePrimaryInput({ description: 'D', ogDescription: 'OD' }, 'description')).toMatchObject({ value: 'OD' })
  })
})

describe('validate', () => {
  const full: MetaTags = {
    ogTitle: 'A perfectly reasonable title length for a social card here',
    ogDescription: 'A description that comfortably lands within the optimal character range so the validator stays quiet about it now.',
    ogType: 'website',
    ogImage: 'https://x/og.png',
    ogImageAlt: 'A blue product card with the product name.',
    ogImageWidth: '1200',
    ogImageHeight: '630',
    twitterCard: 'summary_large_image',
    ogUrl: 'https://x/',
  }

  const find = (m: MetaTags, img?: ImageProbe) => validate(m, img)

  test('clean meta + image produces no issues', () => {
    expect(find(full, okImage())).toHaveLength(0)
  })

  test('missing title, description, image are errors', () => {
    const issues = find({})
    const fields = issues.filter((i) => i.level === 'error').map((i) => i.field)
    expect(fields).toContain('title')
    expect(fields).toContain('description')
    expect(fields).toContain('og:image')
  })

  test('keeps X-only fields as OG errors while naming Slack X-tag support', () => {
    const issues = find({
      twitterTitle: 'Only on X',
      twitterDescription: 'X-only context',
      twitterImage: 'https://x/x.png',
    })
    for (const code of ['missing-title', 'missing-description', 'missing-og-image']) {
      const issue = issues.find((candidate) => candidate.code === code)
      expect(issue).toMatchObject({ level: 'error' })
      expect(issue?.evidence).toContain('X and Slack classic unfurls may consume it')
      expect(issue?.evidence).toContain('Facebook and LinkedIn')
    }
  })

  test('accepts absolute HTTP and HTTPS og:image URLs and rejects other forms', () => {
    for (const ogImage of ['http://x/og.png', 'https://x/og.png']) {
      const issues = find({ ...full, ogImage }, okImage({ url: ogImage, resolved: ogImage }))
      expect(issues.some((i) => i.code === 'relative-og-image')).toBe(false)
    }
    for (const ogImage of ['/og.png', 'ftp://x/og.png', 'data:image/png;base64,AAAA']) {
      const issues = find({ ...full, ogImage })
      expect(issues.find((i) => i.code === 'relative-og-image')).toMatchObject({ level: 'error', field: 'og:image' })
    }
  })

  test('rejects malformed image and canonical URLs', () => {
    const issues = find({ ...full, ogImage: 'https://', ogUrl: '/relative' })
    expect(issues.some((i) => i.code === 'relative-og-image')).toBe(true)
    expect(issues.some((i) => i.code === 'invalid-canonical-url' && i.field === 'og:url')).toBe(true)
  })

  test('uses a 2% LinkedIn ratio tolerance and labels unverified Facebook and X guidance', () => {
    for (const [width, height] of [[1200, 627], [1200, 630]] as const) {
      const issues = find({ ...full, ogImageWidth: String(width), ogImageHeight: String(height) }, okImage({ width, height }))
      expect(issues.some((i) => i.code === 'image-ratio')).toBe(false)
      expect(issues.some((i) => i.code === 'image-resolution')).toBe(false)
    }

    const offRatio = find({ ...full, ogImageWidth: '1200', ogImageHeight: '600' }, okImage({ width: 1200, height: 600 }))
    const ratio = offRatio.find((i) => i.code === 'image-ratio')
    expect(ratio).toMatchObject({ level: 'warn', field: 'og:image' })
    expect(`${ratio?.message} ${ratio?.evidence} ${ratio?.fix}`).toContain('Facebook')
    expect(`${ratio?.message} ${ratio?.evidence} ${ratio?.fix}`).toContain('LinkedIn')
    expect(ratio?.evidence).toContain('2% tolerance')
    expect(ratio?.evidence).toContain('linkedin.com/help/linkedin/answer/a521928')
    expect(ratio?.evidence).toContain('returned HTTP 429 during this review')
    expect(ratio?.evidence).toContain('does not claim a currently verified Facebook ratio or a current X image ratio')
  })

  test('scopes the resolution warning to cited LinkedIn guidance and qualifies Facebook uncertainty', () => {
    const issues = find({ ...full, ogImageWidth: '600', ogImageHeight: '315' }, okImage({ width: 600, height: 315 }))
    const warnings = issues.filter((i) => i.level === 'warn')
    expect(warnings.map((i) => i.code)).toEqual(['image-resolution'])
    expect(warnings[0]?.message).toContain('LinkedIn')
    expect(warnings[0]?.message).not.toContain('cross-platform')
    expect(warnings[0]?.evidence).toContain('1200×627')
    expect(warnings[0]?.evidence).toContain('linkedin.com/help/linkedin/answer/a521928')
    expect(warnings[0]?.evidence).toContain('prior Facebook size guidance is not asserted as current')
  })

  test('declared dimensions mismatch warns', () => {
    const issues = find({ ...full, ogImageWidth: '800', ogImageHeight: '418' }, okImage())
    const mismatch = issues.find((i) => i.code === 'image-dimension-mismatch')
    expect(mismatch).toMatchObject({ level: 'warn', field: 'og:image' })
    expect(mismatch?.evidence).toContain('Facebook')
    expect(mismatch?.evidence).toContain('og:image:width')
    expect(mismatch?.evidence).toContain('og:image:height')
  })

  test('SVG og:image warning cites Facebook image types', () => {
    const issues = find(full, okImage({ contentType: 'image/svg+xml', width: undefined, height: undefined }))
    const svg = issues.find((i) => i.code === 'svg-image')
    expect(svg).toMatchObject({ level: 'warn', field: 'og:image' })
    expect(svg?.evidence).toContain('Facebook')
    expect(svg?.evidence).toContain('JPEG, GIF, and PNG')
    expect(svg?.evidence).toContain('current format list remains unconfirmed')
  })

  test('uses decoded bytes for format validation and reports conflicting image headers', () => {
    const svg = find(full, okImage({ contentType: 'image/png', detectedContentType: 'image/svg+xml' }))
    expect(svg.some((i) => i.code === 'svg-image' && /downloaded bytes/.test(i.evidence))).toBe(true)
    expect(svg.some((i) => i.code === 'image-type-mismatch')).toBe(true)
  })

  test('non-image content-type that also fails to decode is an error', () => {
    const issues = find(full, okImage({ contentType: 'text/html', width: undefined, height: undefined }))
    expect(issues.some((i) => i.level === 'error' && i.code === 'invalid-image-response')).toBe(true)
  })

  test('a real image served as octet-stream (decodes fine) is not flagged', () => {
    const issues = find(full, okImage({ contentType: 'application/octet-stream' }))
    expect(issues.some((i) => i.field === 'og:image' && /decoded as an image/.test(i.message))).toBe(false)
    expect(issues).toHaveLength(0)
  })

  test('oversized image warns', () => {
    const issues = find(full, okImage({ byteLength: 6 * 1024 * 1024 }))
    const size = issues.find((i) => i.code === 'image-file-size')
    expect(size).toMatchObject({ level: 'warn', field: 'og:image' })
    expect(`${size?.message} ${size?.impact} ${size?.evidence}`).toContain('LinkedIn')
    expect(`${size?.message} ${size?.impact} ${size?.evidence}`).not.toContain('X')
  })

  test('labels Facebook first-share guidance as unconfirmed when dimensions are missing', () => {
    const issues = find({ ...full, ogImageWidth: undefined }, okImage())
    const dimensions = issues.find((i) => i.code === 'missing-image-dimensions')
    expect(dimensions).toMatchObject({ level: 'info', field: 'og:image' })
    expect(dimensions?.evidence).toContain('Facebook')
    expect(dimensions?.evidence).toContain('first-share')
    expect(dimensions?.evidence).toContain('remains unconfirmed')
  })

  test('reports og:url as missing even when a canonical link exists', () => {
    const issues = find({ ...full, ogUrl: undefined, canonical: 'https://x/canonical', ogType: undefined }, okImage())
    const url = issues.find((i) => i.code === 'missing-canonical-url')
    expect(url).toMatchObject({ level: 'warn', field: 'og:url', message: 'The required og:url tag is missing.' })
    expect(url?.evidence).toContain('canonical link exists')
    expect(url?.evidence).toContain('ogp.me')
    expect(url?.evidence).toContain('linkedin.com/help/linkedin/answer/a521928')
    expect(url?.fix).toContain('Add og:url')
    expect(url?.fix).not.toContain('or a canonical link')
    expect(issues.find((i) => i.code === 'missing-og-type')).toMatchObject({ level: 'warn', field: 'og:type' })
  })

  test('reports missing twitter:image:alt as withdrawn X guidance', () => {
    const issues = find({ ...full, twitterImage: 'https://x/x.png' }, okImage())
    const alt = issues.find((i) => i.code === 'missing-twitter-image-alt')
    expect(alt).toMatchObject({ level: 'info', field: 'twitter:image:alt', message: 'The X image has no alternative text.' })
    expect(alt?.evidence).toContain('Withdrawn first-party Twitter markup from 2020')
    expect(alt?.evidence).toContain('Current docs.x.com no longer confirms this rule')

    const complete = find({ ...full, twitterImage: 'https://x/x.png', twitterImageAlt: 'An X crop' }, okImage())
    expect(complete.some((i) => i.code === 'missing-twitter-image-alt')).toBe(false)
  })

  test('describes missing, unrendered, and unrecognized X card values without treating them as invalid', () => {
    const missing = find({ ...full, twitterCard: undefined }, okImage()).find((i) => i.code === 'missing-twitter-card')
    expect(missing).toMatchObject({ level: 'info', field: 'twitter:card' })
    expect(missing?.impact).toContain('may choose a default')
    expect(missing?.evidence).toContain('summary card may render from Open Graph tags')
    expect(missing?.evidence).toContain('current docs.x.com no longer confirms')

    for (const card of ['player', 'app']) {
      const issue = find({ ...full, twitterCard: card }, okImage()).find((i) => i.code === 'unusual-twitter-card')
      expect(issue).toMatchObject({ level: 'info', field: 'twitter:card', message: `The ${card} card is not rendered by MetaPrev.` })
      expect(`${issue?.message} ${issue?.impact}`).not.toMatch(/invalid|uncommon/i)
    }

    const unknown = find({ ...full, twitterCard: 'future_card' }, okImage()).find((i) => i.code === 'unusual-twitter-card')
    expect(unknown).toMatchObject({ level: 'info', field: 'twitter:card', message: 'The twitter:card value is unrecognized.' })
  })

  test('does not emit generic title or description length advice', () => {
    const issues = find({ ...full, ogTitle: 'Nook', ogDescription: 'Room to think.' }, okImage())
    const output = issues.map((i) => `${i.message} ${i.impact} ${i.evidence} ${i.fix}`).join('\n')
    expect(output).not.toMatch(/(?:title|description).{0,60}\b\d+\s*(?:characters?|chars?)\b/i)
  })

  test('reports an Open Graph description fallback without inventing copy advice', () => {
    const issues = find({ ...full, ogDescription: undefined, description: 'A factual page description.' }, okImage())
    expect(issues.find((i) => i.code === 'missing-og-description')).toMatchObject({ level: 'warn', field: 'og:description' })
  })

  test('every finding carries stable repair context and is severity-prioritized', () => {
    const issues = find({ title: 'Fallback', twitterImage: 'https://x/x.png' }, undefined)
    for (const issue of issues) {
      expect(Object.keys(issue).sort()).toEqual(['code', 'evidence', 'field', 'fix', 'impact', 'level', 'message'])
      for (const key of ['level', 'field', 'message', 'code', 'impact', 'evidence', 'fix'] as const) {
        expect(issue[key].length).toBeGreaterThan(0)
      }
    }
    const levels = issues.map((i) => i.level)
    expect(levels).toEqual([...levels].sort((a, b) => ({ error: 0, warn: 1, info: 2 }[a] - { error: 0, warn: 1, info: 2 }[b])))
  })
})

describe('renderHtml', () => {
  test('does not double-escape parsed values in card and facts views', () => {
    const meta = parseMeta(`<head><meta property="og:title" content="Ben &amp; Jerry&#8217;s"></head>`)
    const html = renderHtml(report({ meta, issues: validate(meta, undefined) }))
    expect(html).toContain('<div class="mock__title mock__line-clamp">Ben &amp; Jerry’s</div>')
    expect(html).toContain('<dd class="fact__val">Ben &amp; Jerry’s')
  })

  test('never places a remote URL into a CSS url() context', () => {
    const evil = "https://evil.test/x.png');}body{background:red}/*"
    const html = renderHtml(report({
      meta: { ogTitle: 'T', ogDescription: 'd', ogImage: evil },
      image: { url: evil, resolved: evil, status: 404, ok: false, error: 'HTTP 404' },
    }))
    expect(/background-image:\s*url\(['"]?https?:/i.test(html)).toBe(false)
    expect(html).toContain('Image failed to load')
  })

  test('embeds only the validated data URI into CSS', () => {
    const html = renderHtml(report({
      meta: { ogTitle: 'T', ogImage: 'https://x/og.png' },
      image: okImage({ dataUri: 'data:image/png;base64,AAAA' }),
    }))
    expect(html).toContain("background-image:url('data:image/png;base64,AAAA')")
  })

  test('rejects a forged data URI from every inline style context', () => {
    const forged = "data:image/png;base64,AAAA');color:red/*"
    const html = renderHtml(report({
      meta: { ogTitle: 'T', ogImage: 'https://x/og.png' },
      image: okImage({ dataUri: forged }),
    }))
    expect(html).not.toContain(forged)
    expect(html).toContain('No validated OG image')
  })

  test('X falls back to a summary card when there is no image', () => {
    const html = renderHtml(report({ meta: { ogTitle: 'No image here', ogDescription: 'desc' } }))
    expect(html).toContain('mock__summary')
  })

  test('clean report shows the all-clear verdict', () => {
    const meta: MetaTags = {
      ogTitle: 'A perfectly reasonable title length for a social card here',
      ogDescription: 'A description that comfortably lands within the optimal character range so the validator stays quiet about it now.',
      ogType: 'website',
      ogImage: 'https://x/og.png',
      ogImageAlt: 'A blue product card.',
      ogImageWidth: '1200',
      ogImageHeight: '630',
      twitterCard: 'summary_large_image',
      ogUrl: 'https://x/',
    }
    const html = renderHtml(report({ meta, image: okImage(), issues: validate(meta, okImage()) }))
    expect(html).toContain('verdict--ok')
    expect(html).toContain('No validation issues found')
  })

  test('uses X-specific metadata and image without leaking it into OG cards', () => {
    const html = renderHtml(report({
      meta: {
        ogTitle: 'Open Graph title', ogDescription: 'OG description', ogImage: 'https://x/og.png',
        twitterTitle: 'X-only title', twitterDescription: 'X-only description', twitterImage: 'https://x/x.png',
        twitterCard: 'summary',
      },
      image: okImage({ dataUri: 'data:image/png;base64,AAAA' }),
      twitterImage: okImage({ url: 'https://x/x.png', resolved: 'https://x/x.png', dataUri: 'data:image/png;base64,BBBB' }),
    }))
    expect(html).toContain('Open Graph title')
    expect(html).toContain('X-only title')
    expect(html).toContain('twitter:title · twitter:image')
    expect(html).toContain('mock__summary--with-image')
    expect(html).toContain('data:image/png;base64,AAAA')
    expect(html).toContain('data:image/png;base64,BBBB')
    expect(html).toContain('previewed separately; not covered by OG findings')
    expect(html).toContain('these Open Graph findings do not validate that asset for X')
    expect(html).toContain('current image rules are undocumented')
  })

  test('shows crop evidence, repair controls, CSP, and an accessible copy status', () => {
    const html = renderHtml(report({
      meta: { ogTitle: 'Square', ogImage: 'https://x/og.png' },
      image: okImage({ width: 1200, height: 1200, dataUri: 'data:image/png;base64,AAAA' }),
    }))
    expect(html).toContain('Cover mode hides about 48% of the image height')
    expect(html).toContain('Resolved inputs')
    expect(html).toContain('Metadata starting point')
    expect(html).toContain('Copy metadata')
    expect(html).toContain('Copy repair brief')
    expect(html).toContain('Copy agent prompt')
    expect(html).toContain('<h3 class="card__name">Discord</h3>')
    expect(html).not.toContain('<h3 class="card__name">Discord / Slack</h3>')
    expect(html).toContain('Slack classic unfurls inspect common Open Graph and X metadata')
    expect(html).toContain('Slack is not represented by the Discord mock')
    expect(html).toContain('Current docs.x.com does not publish Cards image rules')
    expect(html).toContain('LinkedIn workspace frame 1.91:1; Facebook guidance not reverified')
    expect(html).toContain('first-party pages returned HTTP 429')
    expect(html).not.toMatch(/X (?:target|rule|requirement)[^<]{0,40}1\.91:1/i)
    expect(html).toContain('Content-Security-Policy')
    expect(html).toContain("script-src 'nonce-")
    expect(html).not.toContain("script-src 'unsafe-inline'")
    expect(html).toMatch(/<script nonce="[a-f0-9]{32}">/)
    expect(html).toContain('aria-live="polite"')
  })

  test('renders separate persistent chrome themes and card appearance controls under the nonce CSP', () => {
    const html = renderHtml(report({ meta: { ogTitle: 'Theme controls' } }))
    expect(html).toContain('<html lang="en" data-theme="workbench" data-chrome="light">')
    expect(html).toContain('<meta name="color-scheme" content="light dark" />')
    for (const [value, label] of [
      ['workbench', 'Workbench'],
      ['vintage-paper', 'Vintage Paper'],
      ['modern-minimal', 'Modern Minimal'],
      ['mocha-mousse', 'Mocha Mousse'],
      ['clean-slate', 'Clean Slate'],
      ['solar-dusk', 'Solar Dusk'],
    ]) {
      expect(html).toContain(`<option value="${value}">${label}</option>`)
      expect(html).toContain(`html[data-theme="${value}"][data-chrome="dark"]`)
    }
    expect(html).toContain('aria-label="Report color scheme"')
    expect(html).toContain('data-chrome-set="light"')
    expect(html).toContain('data-chrome-set="dark"')
    expect(html).toContain('aria-label="Card appearance"')
    expect(html).toContain('data-appearance-set="light"')
    expect(html).toContain('data-appearance-set="dark"')
    expect(html).toContain("localStorage.getItem('metaprev-chrome-theme')")
    expect(html).toContain("localStorage.setItem(key, value)")
    expect(html).toContain("window.matchMedia('(prefers-color-scheme: dark)')")
    expect(html).toContain('prefers-reduced-motion: reduce')
    expect(html).toContain('href="#content">Skip to report</a>')
    expect(html).toContain('<main id="content">')
    expect(html).toContain('<h2 class="panel__title">')
    expect(html).not.toContain('class="panel__title">\n              Validation</span>')
    expect(html).not.toContain('class="stage rise"')
    expect(html).toContain('.resolved__row { grid-template-columns: 72px minmax(0, 1fr); gap: 2px 8px; align-items: start; }')
    expect(html).toContain('.resolved__source { grid-column: 2; grid-row: 2; }')

    const nonce = html.match(/script-src 'nonce-([a-f0-9]{32})'/)?.[1]
    expect(nonce).toBeTruthy()
    const scripts = html.match(/<script\b[^>]*>/g) ?? []
    expect(scripts.length).toBeGreaterThanOrEqual(3)
    for (const script of scripts) expect(script).toContain(`nonce="${nonce}"`)
    expect(html).not.toContain("script-src 'unsafe-inline'")
  })

  test('emits contrast-safe chrome tokens and card-scoped placeholder colors', () => {
    const html = renderHtml(report({ meta: { ogTitle: 'Contrast audit' } }))
    const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    expect(style).toMatch(/html\[data-theme\]\[data-chrome\]\s*\{[^}]*--ink-2: color-mix\(in oklch, var\(--ink\) 94%, var\(--paper\)\)/)
    expect(style).toMatch(/html\[data-theme\]\[data-chrome\]\s*\{[^}]*--ink-3: color-mix\(in oklch, var\(--ink\) 88%, var\(--paper\)\)/)
    const lastInk2 = [...style.matchAll(/--ink-2:[^;]+;/g)].at(-1)?.[0]
    expect(lastInk2).toContain('color-mix(in oklch, var(--ink) 94%, var(--paper))')
    for (const theme of ['workbench', 'vintage-paper', 'modern-minimal', 'mocha-mousse', 'clean-slate', 'solar-dusk']) {
      for (const scheme of ['light', 'dark']) {
        if (theme === 'workbench' && scheme === 'light') continue
        const block = style.match(new RegExp(`html\\[data-theme="${theme}"\\]\\[data-chrome="${scheme}"\\] \\{([^}]+)\\}`))?.[1] ?? ''
        expect(block.includes('--ink-2:')).toBe(false)
      }
    }
    for (const token of ['error', 'warn', 'info', 'ok']) {
      expect(html).toContain(`--${token}-ink: var(--ink)`)
    }
    expect(html).toContain('--action: var(--ink)')
    expect(html).toContain('--action-ink: var(--paper)')
    expect(html).toContain('.chip--ok { color: var(--ok-ink);')
    expect(html).toContain('.seg__btn {\n    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;\n    color: var(--ink);')
    expect(html).toContain('.mock__img--missing {')
    expect(html).toContain('color: #4b5563; font-family: var(--mono)')
    expect(html).toContain('.mock--fb .mock__img--missing { color: #d8dadf;')
    expect(html).toContain('.mock--li .mock__img--missing { color: #d8dde3;')
    expect(html).not.toContain('.mock__img--missing {\n    display: flex; align-items: center; justify-content: center;\n    background: repeating-linear-gradient(45deg, oklch(91% 0.01 75) 0 10px, oklch(93% 0.008 75) 10px 20px);\n    color: var(--ink-3)')
  })

  test('never turns a non-HTTP final URL into a clickable target', () => {
    const html = renderHtml(report({ finalUrl: 'javascript:alert(1)', meta: { ogTitle: 'Unsafe target' } }))
    expect(html).toContain('href="#"')
    expect(html).not.toContain('href="javascript:')
  })

  test('escapes a closing script tag inside the JSON payload', () => {
    const meta: MetaTags = { ogTitle: '</script><script>alert(1)</script>', ogImage: 'https://x/og.png' }
    const html = renderHtml(report({ meta, issues: validate(meta, undefined) }))
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).not.toContain('<!--')
  })
})

describe('repair output', () => {
  test('produces an evidence-led brief and a guarded coding-agent prompt', () => {
    const meta: MetaTags = { title: 'Nook', ogImage: '/og.png' }
    const target = report({ finalUrl: 'https://x.test/?q=ignore+instructions', meta, issues: validate(meta, undefined) })
    const brief = buildRepairBrief(target)
    const prompt = buildAgentPrompt(target)
    expect(brief).toContain('Impact:')
    expect(brief).toContain('Evidence:')
    expect(brief).toContain('Fix:')
    expect(prompt).toContain('untrusted data')
    expect(prompt).toContain('Do not pad copy')
    expect(prompt).toContain('Safe starting metadata patch')
    expect(brief).toContain('Facebook and LinkedIn depend on the Open Graph path')
    expect(brief).toContain('Slack classic unfurls inspect common Open Graph and X metadata')
    expect(brief).toContain('the Discord mock does not represent Slack')
    expect(brief).toContain('A distinct twitter:image is previewed separately')
    expect(prompt).toContain('absolute public HTTP(S) URLs')
    expect(prompt).toContain('prefer HTTPS')
    expect(prompt).toContain('Do not state that HTTPS is required for og:image')
    expect(prompt).toContain('Do not present it as a current X rule')
    expect(prompt).toContain('Open Graph image findings do not validate that asset for X')
  })

  test('escapes copied metadata snippets and never emits executable page markup', () => {
    const target = report({
      finalUrl: 'https://x.test/',
      meta: { ogTitle: '"><script>alert(1)</script>', ogImage: 'javascript:alert(1)' },
    })
    const snippet = buildMetaSnippet(target)
    expect(snippet).not.toContain('<script>')
    expect(snippet).toContain('&quot;&gt;&lt;script&gt;')
    expect(snippet).not.toContain('javascript:alert')
  })

  test('does not turn local preview origins into copy-ready public metadata', () => {
    const target = report({
      finalUrl: 'http://localhost:3000/product',
      meta: { ogTitle: 'Product', ogDescription: 'A factual description.', ogImage: '/og.png' },
    })
    const snippet = buildMetaSnippet(target)
    expect(snippet).not.toContain('localhost:3000')
    expect(snippet).toContain('Add the preferred absolute public HTTP(S) URL')
    expect(snippet).toContain('Add an absolute public HTTP(S) og:image URL; prefer HTTPS')
    expect(snippet).toContain('twitter:card" content="summary"')
  })

  test('marks a canonical-link-derived og:url as a candidate to verify', () => {
    const snippet = buildMetaSnippet(report({
      finalUrl: 'https://example.com/current',
      meta: { canonical: 'https://example.com/preferred' },
    }))
    expect(snippet).toContain('Candidate inferred from <link rel="canonical">')
    expect(snippet).toContain('verify it is the preferred Open Graph object URL')
    expect(snippet).toContain('property="og:url" content="https://example.com/preferred"')
  })

  test('marks a distinct X image as separately previewed and documents alt uncertainty', () => {
    const snippet = buildMetaSnippet(report({
      finalUrl: 'https://x.test/',
      meta: {
        ogTitle: 'Open Graph title',
        ogDescription: 'Open Graph description',
        ogImage: 'https://cdn.x.test/og.png',
        twitterImage: 'https://cdn.x.test/x.png',
      },
    }))
    expect(snippet).toContain('MetaPrev previews this X-specific image separately')
    expect(snippet).toContain('Open Graph image findings do not validate it for X')
    expect(snippet).toContain('Current X image rules are undocumented')
    expect(snippet).toContain('Consider twitter:image:alt')
    expect(snippet).toContain('current docs.x.com does not confirm the rule')
  })

  test('documents resolved OG and X fallbacks independently', () => {
    const rows = resolveInputs(report({ meta: { title: 'Page', ogImage: 'https://x/og.png' } }))
    expect(rows.find((r) => r.platform === 'Open Graph' && r.field === 'title')).toMatchObject({ source: '<title>', fallback: true })
    expect(rows.find((r) => r.platform === 'X' && r.field === 'image')).toMatchObject({ source: 'og:image', fallback: true })
  })

  test('Copy findings payload stays distinct from the Copy repair brief payload', () => {
    const target = report({
      finalUrl: 'https://x.test/',
      meta: { ogTitle: 'T' },
      issues: validate({ ogTitle: 'T' }, undefined),
    })
    const findings = buildFindingsText(target)
    const brief = buildRepairBrief(target)
    expect(findings).toContain('1. [')
    expect(findings).not.toContain('metaprev repair brief')
    expect(brief).toContain('metaprev repair brief')
    expect(brief).not.toBe(findings)
  })

  test('shares one twitter:card vocabulary across validator and snippet inputs', () => {
    expect(isKnownTwitterCard(CARD_SUMMARY)).toBe(true)
    expect(isKnownTwitterCard(CARD_SUMMARY_LARGE_IMAGE)).toBe(true)
    expect(isKnownTwitterCard('player')).toBe(true)
    expect(isKnownTwitterCard('summary_large')).toBe(false)
    // A known-but-unrendered card type is preserved verbatim by the repair snippet.
    const snippet = buildMetaSnippet(report({
      finalUrl: 'https://x.test/',
      meta: { ogTitle: 'T', ogImage: 'https://x/og.png', twitterCard: 'player' },
    }))
    expect(snippet).toContain('name="twitter:card" content="player"')
    // Unknown card types fall back to the inferred treatment instead of being copied.
    const fallbackSnippet = buildMetaSnippet(report({
      finalUrl: 'https://x.test/',
      meta: { ogTitle: 'T', ogImage: 'https://x/og.png', twitterCard: 'bananas' },
    }))
    expect(fallbackSnippet).toContain(`content="${CARD_SUMMARY_LARGE_IMAGE}"`)
  })

  test('does not copy local URLs as public repair metadata and preserves intentional X card types', () => {
    const snippet = buildMetaSnippet(report({
      finalUrl: 'http://127.0.0.1:3000/page',
      meta: { ogTitle: 'Local page', ogImage: '/card.png', twitterCard: 'player' },
    }))
    expect(snippet).not.toContain('http://127.0.0.1')
    expect(snippet).toContain('Add the preferred absolute public HTTP(S) URL')
    expect(snippet).toContain('name="twitter:card" content="player"')
  })
})
