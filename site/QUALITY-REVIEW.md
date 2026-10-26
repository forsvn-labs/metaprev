# Inspection quality and transfer review — 26 October 2026

This branch builds on the existing guide-only AdSense preparation and messaging
previews. It does not deploy a service, activate ads, create accounts, or release npm.

## Changes and evidence

- The hosted fetcher requests gzip, Brotli and deflate. Both wire bytes and decoded
  bytes remain capped at 512 KiB for HTML and 5 MiB for images. DNS validation,
  connection pinning, redirects and request deadlines remain in place. It stops at
  a real head closing tag outside comments, quoted attributes and raw-text tags.
  Malformed compression fails closed. No cross-request page cache was introduced;
  each inspection observes a fresh source response and rechecks DNS.
- The metadata tokenizer ignores inert comments, scripts, styles, templates and
  textarea content. A title remains text, even when it contains tag-like strings.
  Attribute values can contain `>`. This is a bounded metadata tokenizer, not a
  browser DOM or a claim of full HTML error recovery.
- First scalar declarations win. `og:image:secure_url` remains attached to its
  image group, preserving the selected image's width, height and alt text.
  Declared image MIME and dimensions are checked against available evidence.
  Invalid dimensions are reported even if the image cannot be downloaded.
- The first video's URL, secure alternate, MIME and dimensions are exposed in
  metadata and diagnosed without downloading videos or claiming playback. Errors
  precede warnings, then optional evidence/coverage notes. Fixes never invent
  video content, codecs or player URLs.
- A distinct video guide supplies server-rendered content, internal links,
  Article/breadcrumb schema, canonical, sitemap and Markdown discovery. Guide
  review dates feed schema and sitemap dates. Private reports have no canonical
  link or public structured-data graph and retain no-store/noindex responses.
- Optional server analytics count only fixed public page paths, status failures
  and three response-time buckets. They ignore query-bearing URLs, inspection
  routes, image requests, POSTs, DNT and GPC. They retain no visitor identifier,
  IP, cookie, referrer or report content. Hourly totals go to host logs only when
  both ANALYTICS_ENABLED and ANALYTICS_OWNER_APPROVED are on. Defaults are off.
  Counts include bots and do not establish people, conversions, LCP or field CWV.

## Repeatable verification

Run from the respective package directories after `bun install`:

```sh
# app/
bun test
bun run typecheck
# site/
bun test test/secure.test.ts test/ads.test.ts test/transfer.test.ts test/analytics.test.ts test/seo-quality.test.ts
bun run typecheck
bun scripts/transfer-benchmark.ts
bun test/ads-browser.ts
bun test/messaging-browser.ts
# With bun server.ts running locally on 4323:
bun test/http.ts
```

The deterministic transfer benchmark models a 256 KiB/s connection with 3,500
structured-data records. On the development Air it transferred 318,790 bytes with
identity encoding versus 25,362 with gzip (92.0% less); decoded content was
identical. Observed modeled transfer time was 1,315 ms versus 106 ms (91.9% less).
These are fixture results, not live-site or field latency. They exclude DNS, TLS
and origin processing. Already compressed image files may see little benefit.

Final checks on the integrated branch: CLI 90/90; site regression 60/60;
real HTTP 45/45; messaging browser 114/114; ad-consent browser 50/50.
Both package typechecks and `git diff --check` passed. Browser ad requests were
intercepted and used fixture IDs; no real impressions were sent. Parent independent
review found no remaining blocking finding after raw-title/tokenizer fixes.

## Primary sources and scope

Checked 26 October 2026:

- [Open Graph structured properties and arrays](https://ogp.me/#structured):
  image/video property grouping and first-tag preference. Open Graph does not
  impose a universal image size or guarantee that consumers embed a video.
- [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls):
  canonicals describe duplicate or substantially similar content. Private reports
  are not duplicate homepage content and no longer identify themselves as such.
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap):
  sitemap dates represent meaningful changes, not the current time on each request.

Current X Cards rules were not re-established: the former developer.x.com Cards
markup URL redirects to a generic docs.x.com overview. Existing historical labels
remain. Facebook, LinkedIn, messaging and X previews are representative simulations;
this work does not promote their assumptions to verified rendering behavior.

## Launch decisions still required

1. Approve hosting separately; verify intended DNS, HTTPS, edge rate limits and
   operational log retention. Hosting PR #8 remains held. No merge or deploy here.
2. Keep PUBLIC_INDEXING off until the canonical host and production acceptance
   checks pass. Search Console verification and traffic observations are future work.
3. Ads remain off. Supply actual approved publisher/unit IDs, site approval,
   reviewed policy/CSP and certified CMP adapter; complete the existing
   [launch-and-ads checklist](docs/launch-and-ads.md) and browser checks against that real configuration.
   No revenue, impression, account approval or consent certification is claimed.
4. Decide whether hourly aggregate counts are useful; review host log retention
   before enabling both analytics flags. No external analytics vendor is needed.
5. The web inspector still probes the selected OG image only. Separate X overrides
   remain explicitly unfetched in the public UI. Video playback, platform caches,
   codecs and third-party crawler behavior require separate validation.

PR creation has a previously reported integration 403. No PR write retry or
alternate write route was attempted by this implementation task.
