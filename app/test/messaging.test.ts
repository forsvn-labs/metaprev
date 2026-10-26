import { describe, expect, test } from 'bun:test'
import { messagingSurfaces, resolveMessagingPreview } from '../src/messaging.ts'
import { renderMessagingCards } from '../src/messaging-render.ts'
import { renderHtml } from '../src/render.ts'
import { hostileReport, messagingReport } from './fixtures/messaging.ts'

describe('messaging surface contract (official sources and documented workspace policy)', () => {
  test('covers requested surfaces plus separate WhatsApp and Slack contexts', () => {
    expect(messagingSurfaces.map(surface => surface.id)).toEqual(['messenger', 'imessage', 'telegram', 'x-chat', 'whatsapp', 'slack'])
  })
  test('messaging policy uses OG copy instead of feed-only overrides', () => {
    for (const surface of messagingSurfaces.filter(surface => surface.id !== 'x-chat')) {
      const preview = resolveMessagingPreview(messagingReport.meta, surface.id)
      expect(preview.title.value).toBe('Open Graph title')
      expect(preview.title.source).toBe('og:title')
      expect(preview.imageUrl).toBe('https://example.com/share.png')
    }
  })
  test('ordinary iMessage omits description; Telegram retains it', () => {
    expect(resolveMessagingPreview(messagingReport.meta, 'imessage').description).toBeNull()
    expect(resolveMessagingPreview(messagingReport.meta, 'telegram').description?.value).toBe('Open Graph description')
  })
  test('records page-level fallback and missing OG image without borrowing feed tags', () => {
    const preview = resolveMessagingPreview({ title: 'Page', description: 'Description', twitterImage: 'https://example.com/x.png' }, 'telegram')
    expect(preview.title).toEqual({ value: 'Page', source: '<title>', fallback: true })
    expect(preview.description?.source).toBe('meta description')
    expect(preview.imageUrl).toBeUndefined()
  })
  test('X Chat stays unverified without adopting X feed metadata', () => {
    const preview = resolveMessagingPreview(messagingReport.meta, 'x-chat')
    expect(preview.surface.status).toBe('unverified')
    expect(preview.title.value).toBeUndefined()
    expect(preview.description).toBeNull()
    expect(preview.imageUrl).toBeUndefined()
  })
})

describe('rendered messaging output contract', () => {
  test('missing title does not hide image and description source evidence', () => {
    const html = renderMessagingCards({ ...messagingReport, meta: {
      ogImage: messagingReport.meta.ogImage, ogDescription: 'Description without a title',
    } }, messagingReport.image?.dataUri)
    expect(html.split('Title: none · Image: og:image').length - 1).toBe(5)
    expect(html.split('Description: og:description').length - 1).toBe(4)
    expect(html.split('No metadata rendering assumed').length - 1).toBe(1)
    expect(html).toContain('Description without a title')
    expect(html).toContain('<img ')
  })
  test('both report contexts include evidence, local controls and no connected integrations', () => {
    const html = renderMessagingCards(messagingReport, messagingReport.image?.dataUri)
    expect(html).toContain('Simulated preview')
    expect(html).toContain('Needs live verification')
    expect(html).toContain('No messaging accounts connected')
    expect(html).toContain('data-messaging-size')
    expect(html).toContain('data-messaging-disabled')
    expect(renderHtml(messagingReport)).toContain('data-messaging-surface="telegram"')
    expect(html).not.toContain('Feed-only title')
    expect(html).not.toContain('https://example.com/feed.png')
  })
  test('escapes hostile metadata and refuses active URLs or SVG data', () => {
    const html = renderMessagingCards(hostileReport, hostileReport.image?.dataUri)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('<img src="https://evil.example')
    expect(html).not.toContain('src="data:image/svg')
  })
  test('remote URLs and failed image probes cannot become preview requests', () => {
    for (const image of [undefined, { ...messagingReport.image!, ok: false }]) {
      const html = renderMessagingCards({ ...messagingReport, image }, 'https://example.com/track.png')
      expect(html).not.toContain('<img ')
      expect(html).toContain('Image not available')
    }
  })
})
