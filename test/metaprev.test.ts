import { describe, expect, test } from 'bun:test'
import { parseMeta } from '../src/parse.ts'
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
      <meta property="og:description" content="OG desc">
      <meta property="og:image" content="https://x/og.png">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:image" content="https://x/tw.png">
      <link rel="canonical" href="https://x/canonical">
    </head>`)
    expect(m.title).toBe('Page Title')
    expect(m.ogTitle).toBe('OG Title')
    expect(m.ogImage).toBe('https://x/og.png')
    expect(m.twitterCard).toBe('summary_large_image')
    expect(m.twitterImage).toBe('https://x/tw.png')
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
    const m = parseMeta(`<head><meta property='og:title' content='Single'><meta property=og:description content=Bare></head>`)
    expect(m.ogTitle).toBe('Single')
    expect(m.ogDescription).toBe('Bare')
  })

  test('first og:image wins; og:image:secure_url is an alias', () => {
    const m = parseMeta(`<head><meta property="og:image" content="https://x/a.png"><meta property="og:image:secure_url" content="https://x/b.png"></head>`)
    expect(m.ogImage).toBe('https://x/a.png')
  })
})

describe('validate', () => {
  const full: MetaTags = {
    ogTitle: 'A perfectly reasonable title length for a social card here',
    ogDescription: 'A description that comfortably lands within the optimal character range so the validator stays quiet about it now.',
    ogImage: 'https://x/og.png',
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

  test('relative og:image is an error', () => {
    const issues = find({ ...full, ogImage: '/og.png' })
    expect(issues.some((i) => i.level === 'error' && /absolute URL/.test(i.message))).toBe(true)
  })

  test('off-ratio image warns; near-ratio non-1200x630 is info', () => {
    const square = find(full, okImage({ width: 800, height: 800 }))
    expect(square.some((i) => i.level === 'warn' && i.field === 'og:image')).toBe(true)
    const near = find(full, okImage({ width: 1146, height: 600 })) // 1.91:1, >=600
    expect(near.some((i) => i.level === 'info' && /Recommended/.test(i.message))).toBe(true)
  })

  test('small image warns', () => {
    const issues = find(full, okImage({ width: 400, height: 209 }))
    expect(issues.some((i) => /at least 600px/.test(i.message))).toBe(true)
  })

  test('declared dimensions mismatch warns', () => {
    const issues = find({ ...full, ogImageWidth: '800', ogImageHeight: '418' }, okImage())
    expect(issues.some((i) => /does not match actual/.test(i.message))).toBe(true)
  })

  test('SVG og:image warns', () => {
    const issues = find(full, okImage({ contentType: 'image/svg+xml', width: undefined, height: undefined }))
    expect(issues.some((i) => i.level === 'warn' && /SVG/.test(i.message))).toBe(true)
  })

  test('non-image content-type that also fails to decode is an error', () => {
    const issues = find(full, okImage({ contentType: 'text/html', width: undefined, height: undefined }))
    expect(issues.some((i) => i.level === 'error' && /could not be decoded/.test(i.message))).toBe(true)
  })

  test('a real image served as octet-stream (decodes fine) is not flagged', () => {
    const issues = find(full, okImage({ contentType: 'application/octet-stream' }))
    expect(issues.some((i) => i.field === 'og:image' && /decoded as an image/.test(i.message))).toBe(false)
    expect(issues).toHaveLength(0)
  })

  test('oversized image warns', () => {
    const issues = find(full, okImage({ byteLength: 9 * 1024 * 1024 }))
    expect(issues.some((i) => /MB/.test(i.message))).toBe(true)
  })
})

describe('renderHtml', () => {
  test('does not double-escape facts values', () => {
    const meta = parseMeta(`<head><meta property="og:title" content="Ben &amp; Jerry&#8217;s"></head>`)
    const html = renderHtml(report({ meta, issues: validate(meta, undefined) }))
    expect(html).toContain('Ben &amp; Jerry’s')
    expect(html).not.toContain('&amp;amp;')
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

  test('X falls back to a summary card when there is no image', () => {
    const html = renderHtml(report({ meta: { ogTitle: 'No image here', ogDescription: 'desc' } }))
    expect(html).toContain('mock__summary')
  })

  test('clean report shows the all-clear verdict', () => {
    const meta: MetaTags = {
      ogTitle: 'A perfectly reasonable title length for a social card here',
      ogDescription: 'A description that comfortably lands within the optimal character range so the validator stays quiet about it now.',
      ogImage: 'https://x/og.png',
      ogImageWidth: '1200',
      ogImageHeight: '630',
      twitterCard: 'summary_large_image',
      ogUrl: 'https://x/',
    }
    const html = renderHtml(report({ meta, image: okImage(), issues: validate(meta, okImage()) }))
    expect(html).toContain('verdict--ok')
    expect(html).toContain('No issues found')
  })

  test('escapes a closing script tag inside the JSON payload', () => {
    const meta: MetaTags = { ogTitle: '</script><script>alert(1)</script>', ogImage: 'https://x/og.png' }
    const html = renderHtml(report({ meta, issues: validate(meta, undefined) }))
    expect(html).not.toContain('</script><script>alert(1)')
  })
})
