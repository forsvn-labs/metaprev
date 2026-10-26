import { expect, test } from 'bun:test'
import { parseMeta } from '../src/parse.ts'
import { validate } from '../src/validate.ts'

test('secure image alternate preserves first-root dimensions and ignores later image properties', () => {
  const meta = parseMeta('<meta property="og:image" content="http://example.com/a.png"><meta property="og:image:secure_url" content="https://example.com/a.png"><meta property="og:image:width" content="1200"><meta property="og:image:alt" content="First"><meta property="og:image" content="https://example.com/b.png"><meta property="og:image:width" content="20">')
  expect(meta.ogImageWidth).toBe('1200')
  expect(meta.ogImageAlt).toBe('First')
  expect(meta.ogImageSecureUrl).toBe('https://example.com/a.png')
})
test('first scalar wins and inert markup cannot fabricate metadata', () => {
  const meta = parseMeta('<head><!-- <meta property="og:title" content="Fake"> --><script>const text = \'</head><meta property="og:title" content="Fake">\'</script><meta property="og:title" content="Real"><meta property="og:title" content="Later"></head><meta property="og:description" content="Body">')
  expect(meta.ogTitle).toBe('Real')
  expect(meta.ogDescription).toBeUndefined()
})
test('video properties attach to first video and produce bounded evidence, never playback claims', () => {
  const meta = parseMeta('<meta property="og:video" content="http://example.com/v.mp4"><meta property="og:video:type" content="video/mp4"><meta property="og:video:width" content="wide"><meta property="og:video" content="https://example.com/other.mp4"><meta property="og:video:height" content="1080">')
  expect(meta.ogVideoType).toBe('video/mp4')
  expect(meta.ogVideoHeight).toBeUndefined()
  const issues = validate(meta, undefined)
  expect(issues.some(i => i.code === 'invalid-video-dimensions')).toBe(true)
  expect(issues.some(i => i.code === 'video-unverified')).toBe(true)
  expect(issues.some(i => i.code === 'insecure-video')).toBe(true)
})
test('invalid declared dimensions are diagnosed even when image fetch fails', () => {
  expect(validate({ ogImage: 'https://example.com/a.png', ogImageWidth: 'wide', ogImageHeight: '0' }, undefined).some(i => i.code === 'invalid-image-dimensions')).toBe(true)
})
test('raw title and quoted greater-than signs do not fabricate or truncate tags', () => {
  const meta = parseMeta('<head><title><meta property="og:title" content="Fake"></title><meta property="og:title" content="Real > <!-- literal"><meta property="og:description" content="Expected"></head>')
  expect(meta.ogTitle).toBe('Real > <!-- literal')
  expect(meta.ogDescription).toBe('Expected')
  expect(meta.title).toContain('<meta')
})
test('malformed-looking raw script content does not swallow real metadata', () => {
  expect(parseMeta('<head><script>const x = `<fake "`;</script><meta property="og:title" content="Real"></head>').ogTitle).toBe('Real')
})
test('checks each declared dimension and image MIME without inventing fetch evidence', () => {
  const issues = validate({ ogImage: 'https://example.com/a.png', ogImageWidth: '-1', ogImageType: 'image/jpeg' }, { url: 'https://example.com/a.png', resolved: 'https://example.com/a.png', ok: true, status: 200, width: 1200, height: 630, detectedContentType: 'image/png', contentType: 'image/png' })
  expect(issues.some(i => i.code === 'invalid-image-dimensions')).toBe(true)
  expect(issues.some(i => i.code === 'declared-image-type-mismatch')).toBe(true)
})
