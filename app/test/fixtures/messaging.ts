import type { Report } from '../../src/types.ts'

// Illustrative fixtures deliberately separate OG and feed-only overrides.
export const messagingReport: Report = {
  source: 'https://example.com/notes', finalUrl: 'https://example.com/notes',
  status: 200, fetchedAt: '2026-10-26T09:00:00.000Z', issues: [],
  meta: {
    title: 'Page title', description: 'Page description',
    ogTitle: 'Open Graph title', ogDescription: 'Open Graph description',
    ogImage: 'https://example.com/share.png', ogImageAlt: 'Share artwork with three colored bars', ogSiteName: 'Example Notes',
    twitterTitle: 'Feed-only title', twitterDescription: 'Feed-only description',
    twitterImage: 'https://example.com/feed.png', twitterCard: 'summary_large_image',
  },
  image: {
    url: 'https://example.com/share.png', resolved: 'https://example.com/share.png',
    status: 200, ok: true, width: 1200, height: 630, contentType: 'image/png',
    dataUri: 'data:image/png;base64,iVBORw0KGgo=',
  },
}

export const hostileReport: Report = {
  ...messagingReport,
  finalUrl: 'javascript:alert(1)',
  meta: { ogTitle: '<img src=x onerror=alert(1)>', ogDescription: '</script><script>alert(1)</script>',
    ogSiteName: '" onmouseover="alert(1)', ogImage: 'https://evil.example/track.png' },
  image: { ...messagingReport.image!, dataUri: 'data:image/svg+xml;base64,PHN2Zz4=' },
}
