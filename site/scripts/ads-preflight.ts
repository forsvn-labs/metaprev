import { adsConfig } from '../lib/ads.ts'
console.info(JSON.stringify({
  advertisingEnabled: adsConfig.enabled,
  authorizedAdsTxt: adsConfig.publishAdsTxt,
  blockers: adsConfig.blockers,
  scope: 'One manual display slot on each existing individual public guide only',
  remainingLiveChecks: [
    'Owned HTTPS domain, approved hosting cost and working public backend',
    'Actual publisher/site approval and manual unit from the approved account',
    'Owner-reviewed disclosures and current Google-certified CMP',
    'Real CMP settings UI, TCF v2.3 signals, deny/revoke and regional policy',
    'Provider CSP, responsive placement, no-fill and ad-blocking acceptance',
    'Static edge export must include authorized ads.txt/scripts and retain nonce policy, or stay disabled',
    'Explicit production approval; configuration flags are attestations, not evidence',
  ],
}, null, 2))
process.exitCode = adsConfig.enabled ? 0 : 1
