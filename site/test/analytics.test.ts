import { expect, test } from 'bun:test'
import { AggregateAnalytics } from '../lib/analytics.ts'
const record = (analytics: AggregateAnalytics, path: string, headers = {}, method = 'GET') => analytics.record(new Request(`https://metaprev.example${path}`, { headers, method }), 200, 42)
test('disabled by default; explicit owner activation only', () => {
  const analytics = new AggregateAnalytics({ ANALYTICS_ENABLED: 'on' })
  record(analytics, '/guides/og-image')
  expect(analytics.drain()).toBeNull()
})
test('only fixed public routes without queries; no inspection, images, identifiers or request content', () => {
  const analytics = new AggregateAnalytics({ ANALYTICS_ENABLED: 'on', ANALYTICS_OWNER_APPROVED: 'on' })
  for (const path of ['/api/inspect', '/inspect', '/api/image?id=secret', '/guides/og-image?url=private', '/unknown-private-url']) record(analytics, path)
  record(analytics, '/guides/og-image', { DNT: '1' })
  record(analytics, '/guides/og-image', { 'Sec-GPC': '1' })
  record(analytics, '/guides/og-image', {}, 'POST')
  record(analytics, '/guides/og-image', { 'User-Agent': 'private-agent', Cookie: 'secret', Referer: 'https://private.example' })
  const snapshot = analytics.drain()
  expect(snapshot?.routes).toHaveLength(1)
  expect(snapshot?.routes[0]?.requests).toBe(1)
  const serialized = JSON.stringify(snapshot)
  expect(serialized).not.toContain('private')
  expect(serialized).not.toContain('secret')
  expect(analytics.drain()).toBeNull()
})
