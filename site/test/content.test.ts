// Failure modes recorded before implementation: malformed/duplicate URLs,
// incomplete records, unsafe source/support links, invalid review dates,
// accidental draft publication, and unreviewed/future-dated publication.
import { describe, expect, test } from 'bun:test'
import { parseGuides, publishedGuides, parseSupportUrl } from '../lib/content.ts'
const record = { slug: 'example', field: 'og:image', title: 'Example guide', description: 'A guide description', answer: 'An answer', intent: 'A distinct task', checks: ['Check the page'], example: '<meta property="og:image">', limitation: 'A limitation', source: { name: 'Protocol', url: 'https://ogp.me/' }, status: 'published', reviewed: '2026-11-07' }
describe('content publication boundary', () => {
  test('accepts a complete guide and excludes drafts', () => {
    const records = parseGuides([record, { ...record, slug: 'draft', status: 'draft' }])
    expect(publishedGuides(records, '2026-11-07').map(g => g.slug)).toEqual(['example'])
  })
  test('rejects duplicates and unsafe slugs', () => {
    expect(() => parseGuides([record, record])).toThrow()
    for (const slug of ['../admin', 'a/b', '', 'UPPER']) expect(() => parseGuides([{ ...record, slug }])).toThrow()
  })
  test('requires substantive fields and safe source links', () => {
    expect(() => parseGuides([{ ...record, checks: [] }])).toThrow()
    expect(() => parseGuides([{ ...record, answer: ' ' }])).toThrow()
    expect(() => parseGuides([{ ...record, source: { name: 'Bad', url: 'javascript:alert(1)' } }])).toThrow()
  })
  test('requires a real review date, and rejects a future published review', () => {
    expect(() => parseGuides([{ ...record, reviewed: '2026-02-30' }])).toThrow()
    expect(() => parseGuides([{ ...record, reviewed: '' }])).toThrow()
    expect(() => publishedGuides(parseGuides([record]), '2026-11-06')).toThrow()
  })
  test('support stays hidden until configured; allows only known HTTPS providers', () => {
    expect(parseSupportUrl('')).toBe('')
    expect(parseSupportUrl('https://github.com/sponsors/hungv47')).toBe('https://github.com/sponsors/hungv47')
    for (const url of ['javascript:alert(1)', 'http://ko-fi.com/hung', 'https://github.com/hungv47', 'https://ko-fi.com.evil.test/hung', 'https://user:pass@ko-fi.com/hung']) expect(() => parseSupportUrl(url)).toThrow()
  })
})
