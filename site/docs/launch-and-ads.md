# Launch and advertising preparation

26 October 2026. This increment is prepared in an isolated worktree. It creates
no account, accepts no terms, changes no billing or DNS, and deploys nothing.

## Observed public state

The owning VISION and existing launch manifest identify `metaprev.forsvn.com`.
On 26 October its public DNS returned NXDOMAIN. The retained
`ops/public-launch-20261024` branch records a partial Worker/assets upload;
the container backend was rejected on Workers Free, then the owner put hosting
on hold before payment. Do not repeat that deployment or upgrade billing from
this branch. Draft launch PR #8 remains separate from this work.

The prepared Cloudflare container plan needs Workers Paid ($5/month plus metered
usage). One instance and idle sleep reduce usage; they do not impose a hard bill
cap. Hosting choice, cost approval, HTTPS, per-client edge limits and operational
log retention remain release prerequisites. The current Bun service can be
checked with `bun test/launch-http.ts`; `/healthz` is a first-party readiness probe.

## Included behavior

Ads are off by default. One manual AdSense slot is eligible only on the four
existing individual public guides. The homepage inspector, forms, reports,
errors, private images, APIs, CLI output and privacy page have no ad scripts.
Ad blocking never gates access. Query and fragment URLs do not load the CMP or
ad network; the loader rechecks location when consent changes.

`bun run preflight:ads` prints every missing configuration gate and exits 1
while ads are disabled. The flags in `.env.example` are owner attestations;
they do not prove approval, ownership, legal review or provider certification.
No publisher ID or manual ad-unit ID is supplied. Use the real account values.
`ADS_TXT_ENABLED=on` can publish the actual seller record separately before site
approval, with valid publisher/origin and `ADS_OWNER_APPROVED=on`. It never
loads an ad script. Google recommends ads.txt; this product requires it.

The owner must install reviewed CMP integration at ignored `public/ads-cmp.js`.
It must load a currently Google-certified TCF CMP, expose `window.__tcfapi`, and
expose `window.metaprevAdPrivacyChoices()` to open the CMP's actual settings UI.
This adapter is not a home-made consent banner. No adapter is provided here.
The script waits at most ten seconds and requires a successful loaded CMP
callback, a nonempty current consent string, a CMP ID, completed choice,
GDPR=true, vendor 755 consent and purposes 1,2,3,4,7,9,10 consent. Unknown,
failed, denied and non-GDPR signals stay off. This intentionally restrictive
first increment does not implement a reviewed consent path for other regions.

Revocation, back/forward cache restoration and failures after SDK execution end
the ad document at the same guide with `?ads=off`. That document loads no CMP or
ad network. A blocked SDK before execution does not cause a reload loop.
The privacy control remains available after denial. Ad-free or script-disabled
guide documents retain a clean guide link for reopening choices. Allowing ads again after a
stopped session requires a clean guide navigation and current CMP consent.

Only eligible active guide responses use a fresh script nonce and strict-dynamic
CSP. They are no-store/noindex and have no-referrer. All other routes retain the
existing first-party CSP. Google's supported CSP is broader than this strict
implementation; test the actual provider and CMP before activation. Do not
weaken inspector policies to make an ad render.

## Activation checklist

1. Resolve and approve hosting/costs, domain, operational logs and backend launch.
2. Obtain permission for the actual publisher application/account and site review;
   configure an approved manual unit and real IDs. Never fabricate them.
3. Publish reviewed vendor/cookie/rights/choice disclosures, a current certified
   CMP, regional rules and a working reopen/withdraw path. Review the current
   Google vendor and TCF v2.3 requirements, not a stored accept boolean.
4. Verify actual ad/CMP browser behavior and CSP, denied/withdrawn consent, ad
   blocking, no-fill, accessible 320px layout, one unit and no private-route code.
5. Integrate with the separate launch branch. Its static exporter must carry the
   new privacy text, authorized ads.txt, loader and CMP asset, and must generate
   fresh response nonces or retain ads off. This branch does not change that
   exporter or establish an enabled Cloudflare deployment.
6. Obtain explicit production release and ad activation approval. Keep all flags
   off until the corresponding evidence and approval exist.

## Provider choice and cost limits

AdSense is free to join but requires original useful content and site review;
there is no published numerical traffic floor on its eligibility page. Public
guides are plausible inventory; acceptance and revenue are unknown. Carbon
requires 10,000 pageviews/month and site-wide exclusivity. EthicalAds normally
requires 50,000 pageviews/month and one ad/page. Both target developers and may
fit Metaprev later. No measured traffic or approved inventory is established.
No revenue forecast, account acceptance or total hosting cost is claimed.

Official sources checked 26 October 2026:

- [AdSense eligibility](https://support.google.com/adsense/answer/9724?hl=en)
- [AdSense costs](https://support.google.com/adsense/answer/9902?hl=en)
- [Certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en)
- [Current TCF guidance](https://support.google.com/adsense/answer/9999955?hl=en)
- [Required privacy content](https://support.google.com/adsense/answer/1348695?hl=en)
- [Seller declarations](https://support.google.com/adsense/answer/12171612?hl=en)
- [Nonce CSP](https://support.google.com/adsense/answer/16283098?hl=en)
- [Publisher placement policy](https://support.google.com/adsense/answer/1346295?hl=en)
- [EthicalAds FAQ](https://www.ethicalads.io/publishers/faq/)
- [Carbon eligibility](https://www.carbonads.net/join)
- [Cloudflare container pricing](https://developers.cloudflare.com/containers/platform/pricing/)

## Verification commands

Run from `site/` after `bun install`:

```sh
bun run test
bun run typecheck
bun run test:ads-browser
bun test/launch-http.ts
bun run preflight:ads
```

Failure cases were specified in `test/ads-acceptance.md` before implementation.
The browser test intercepts all network traffic and uses explicit syntactic
fixtures. It sends no real impressions. Repeatable JSON and captures are in
ignored `artifacts/`; actual provider delivery and CMP certification remain
unverified until an authorized real configuration exists.

## Local verification on 26 October

The final Metaprev contract run passed 47 tests; typecheck passed. Chromium
passed 50 checks at 320 and 1440 CSS pixels with all traffic intercepted. The
running loopback service passed 18 checks. Spec and standards reviewers found
SDK-error, URL-mutation and BFCache lifecycle gaps; the saved implementation
addresses them and the Chromium regressions pass. The default preflight exits 1
and lists the absent account, consent and approval configuration, as intended.
These results establish a tested local increment, not a live launch or real ad
provider acceptance. Runtime JSON and captures are under ignored `artifacts/`.

## Coordination with messaging surfaces

Surface PR #9 is commit `a8eddd5`. A read-only three-way comparison first
found two append-only conflicts: `site/README.md` and `site/public/styles.css`.
Advertising styles now live in `site/public/ads.css`, and this branch's README
section sits before request limits. The surface adapters, report hooks and
scoped messaging CSS are untouched. Apply/review surface PR #9 first, then this
increment; retain both documentation sections. Run CLI/surface tests plus site
contract, typecheck, messaging browser, ads browser and HTTP checks together
before considering a later release. Neither branch changes or approves the
separate hosting PR #8. No branch was merged for this comparison.
