import { existsSync } from 'node:fs'
import { isIP } from 'node:net'
import { guides } from '../data/guides.ts'

type Environment = Record<string, string | undefined>
export type AdsConfig = {
  enabled: boolean; blockers: string[]; client: string; slot: string;
  origin: string; publishAdsTxt: boolean;
}

function publicOrigin(raw: string | undefined): string {
  try {
    const url = new URL(raw ?? '')
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash || isIP(url.hostname) ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) ||
      /\.(localhost|local|internal|test|invalid|example)$/i.test(url.hostname)) return ''
    return url.origin
  } catch { return '' }
}

export function readAdsConfig(env: Environment, cmpInstalled: boolean): AdsConfig {
  const client = /^ca-pub-\d{16}$/.test(env.ADSENSE_CLIENT ?? '') && !/^ca-pub-0+$/.test(env.ADSENSE_CLIENT ?? '') ? env.ADSENSE_CLIENT! : ''
  const slot = /^\d{10}$/.test(env.ADSENSE_SLOT ?? '') && !/^0+$/.test(env.ADSENSE_SLOT ?? '') ? env.ADSENSE_SLOT! : ''
  const origin = publicOrigin(env.SITE_URL)
  const blockers: string[] = []
  for (const name of ['ADS_ENABLED', 'ADS_OWNER_APPROVED', 'ADS_SITE_APPROVED', 'ADS_PRIVACY_REVIEWED', 'ADS_CMP_READY', 'ADS_TXT_ENABLED', 'ADS_CSP_REVIEWED']) {
    if (env[name] !== 'on') blockers.push(`${name} must be on after its review`)
  }
  if (!client) blockers.push('ADSENSE_CLIENT must be the actual approved publisher ID')
  if (!slot) blockers.push('ADSENSE_SLOT must be the actual manual display unit ID')
  if (!origin) blockers.push('SITE_URL must be an owned public HTTPS origin without a path')
  if (!cmpInstalled) blockers.push('Install the reviewed certified CMP adapter at public/ads-cmp.js')
  return {
    enabled: blockers.length === 0, blockers, client, slot, origin,
    publishAdsTxt: Boolean(client && origin && env.ADS_TXT_ENABLED === 'on' && env.ADS_OWNER_APPROVED === 'on'),
  }
}

export const adsConfig = readAdsConfig(process.env, existsSync(new URL('../public/ads-cmp.js', import.meta.url)))
export function eligibleAdPath(path: string): boolean { return guides.some(guide => path === `/guides/${guide.slug}`) }
export function adsTxt(config: AdsConfig): string | null {
  return config.publishAdsTxt ? `google.com, ${config.client.slice(3)}, DIRECT, f08c47fec0942fa0\n` : null
}
export function renderAds(config: AdsConfig, path: string): string {
  if (!config.enabled || !eligibleAdPath(path)) return ''
  // Values are strictly parsed above. No page or visitor input enters this element.
  return `<aside class="advertisement" data-metaprev-ad data-client="${config.client}" data-slot="${config.slot}" data-origin="${config.origin}" aria-label="Advertising choices"><div data-ad-container hidden><p>Advertisement</p><ins class="adsbygoogle" data-ad-client="${config.client}" data-ad-slot="${config.slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></div><button type="button" data-ad-privacy>Advertising privacy choices</button><a href="/privacy">Privacy</a></aside><script src="/ads.js" defer></script>`
}
export function advertisingCsp(config: AdsConfig, path: string, nonce?: string): string | null {
  if (!config.enabled || !eligibleAdPath(path) || !nonce) return null
  // Google supports strict CSP; its script domains change. Only public guides
  // receive this policy. No unsafe-eval fallback; validate the real CMP before activation.
  return `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
}
