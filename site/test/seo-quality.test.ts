import { expect, test } from 'bun:test'
import { page } from '../lib/page.ts'
import { guides } from '../data/guides.ts'
test('private results carry no canonical or public structured data', () => {
  const html = page({ title: 'Result', body: '<main>Private</main>', privatePage: true })
  expect(html).not.toContain('rel="canonical"')
  expect(html).not.toContain('application/ld+json')
  expect(html).toContain('noindex, nofollow')
})
test('video guide supplies distinct search intent, honest limits and primary source', () => {
  const guide = guides.find(g => g.slug === 'og-video')
  expect(guide?.source.url).toBe('https://ogp.me/#structured')
  expect(guide?.limitation).toContain('does not fetch video')
  expect(guide?.reviewed).toBe('2026-10-26')
})
