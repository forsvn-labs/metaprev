import { describe, expect, test } from 'bun:test'
import { adsTxt, readAdsConfig, renderAds, advertisingCsp } from '../lib/ads.ts'

// Syntactic test fixtures only. These are not publisher credentials.
const env = {
  SITE_URL: 'https://metaprev.forsvn.com', ADS_ENABLED: 'on',
  ADS_OWNER_APPROVED: 'on', ADS_SITE_APPROVED: 'on', ADS_PRIVACY_REVIEWED: 'on',
  ADS_CMP_READY: 'on', ADS_TXT_ENABLED: 'on',
  ADS_CSP_REVIEWED: 'on',
  ADSENSE_CLIENT: 'ca-pub-1234567890123456', ADSENSE_SLOT: '1234567890',
}
describe('advertising activation boundary', () => {
  test('defaults to disabled and publishes no account', () => {
    const config = readAdsConfig({}, false)
    expect(config.enabled).toBe(false)
    expect(adsTxt(config)).toBeNull()
    expect(renderAds(config, '/guides/og-image')).toBe('')
  })
  for (const field of Object.keys(env)) test(`requires ${field}`, () => {
    const incomplete: Record<string, string> = { ...env }
    delete incomplete[field]
    expect(readAdsConfig(incomplete, true).enabled).toBe(false)
  })
  test('requires a real local CMP adapter', () => expect(readAdsConfig(env, false).enabled).toBe(false))
  test('rejects invalid IDs and non-public HTTPS origins', () => {
    for (const client of ['pub-123', 'ca-pub-0000000000000000', '<script>', env.ADSENSE_CLIENT + 'x']) {
      expect(readAdsConfig({ ...env, ADSENSE_CLIENT: client }, true).enabled).toBe(false)
    }
    for (const origin of ['http://metaprev.forsvn.com', 'https://localhost', 'https://127.0.0.1', 'https://user:pass@example.org', 'https://example.org/path', 'https://site.example', 'https://[::1]', 'https://192.168.1.2', 'https://example.org:4323', 'https://example.org/?secret=a']) {
      expect(readAdsConfig({ ...env, SITE_URL: origin }, true).enabled).toBe(false)
    }
  })
  test('allows an authorized ads.txt entry while site approval remains pending', () => {
    const config = readAdsConfig({ ...env, ADS_SITE_APPROVED: 'off', ADS_ENABLED: 'off' }, false)
    expect(config.enabled).toBe(false)
    expect(adsTxt(config)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n')
    expect(adsTxt(readAdsConfig({ ...env, ADS_OWNER_APPROVED: 'off' }, true))).toBeNull()
  })
  test('only emits a single inert slot for individual public guides', () => {
    const config = readAdsConfig(env, true)
    expect(config.enabled).toBe(true)
    expect(config.blockers).toEqual([])
    const html = renderAds(config, '/guides/og-image')
    expect(html).toContain('Advertisement')
    expect(html).toContain(' hidden')
    expect(html).toContain('/ads.js')
    expect(html).not.toContain('src="https://')
    for (const path of ['/', '/inspect', '/api/inspect', '/privacy', '/about', '/guides', '/guides/missing', '/guides/og-image?url=secret']) {
      expect(renderAds(config, path)).toBe('')
      expect(advertisingCsp(config, path)).toBeNull()
    }
    expect(advertisingCsp(config, '/guides/og-image', 'random-per-response')).toContain("'nonce-random-per-response' 'strict-dynamic'")
  })
})
