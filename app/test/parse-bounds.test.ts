// Failure modes: long valueless attributes, whitespace-only tags, repeated
// unterminated tags/titles/heads, and losing valid attributes after a boolean.
import { expect, test } from 'bun:test'
import { parseMeta } from '../src/parse.ts'

const cases = {
  attribute: '<meta ' + 'x'.repeat(32000) + '>',
  whitespace: '<meta ' + ' '.repeat(32000),
  tags: '<meta '.repeat(16000),
  titles: '<title>'.repeat(16000),
  heads: '<head>'.repeat(16000),
}
for (const [name, input] of Object.entries(cases)) {
  test(`bounded parse of malformed ${name}`, () => {
    const start = performance.now()
    parseMeta(input)
    // Generous local regression ceiling, not a Worker CPU guarantee.
    expect(performance.now() - start).toBeLessThan(100)
  })
}
test('boolean attributes do not hide later metadata or become values', () => {
  expect(parseMeta('<meta content property="og:title"><meta disabled property="og:description" content="Works">'))
    .toEqual({ ogDescription: 'Works' })
})
test('title and head selection keeps first title and excludes body metadata', () => {
  expect(parseMeta('<head><title>First</title><title>Second</title><meta property="og:title" content="Head"></head><meta property="og:title" content="Body">'))
    .toEqual({ title: 'First', ogTitle: 'Head' })
})
test('self-closing unquoted attributes keep the existing value', () => {
  expect(parseMeta('<meta property=og:title content=Works/>').ogTitle).toBe('Works')
})
test('unterminated opening heads have bounded cost', () => {
  const input = '<head'.repeat(20000)
  const start = performance.now()
  parseMeta(input)
  expect(performance.now() - start).toBeLessThan(100)
})
