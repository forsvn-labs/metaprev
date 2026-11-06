# Progress

Updated: 2026-11-07 · Stage: live · Health: On track

## Shipped

- **Public Open Graph review** (2026-11-07): live at https://metaprev.forsvn.com, alongside the existing CLI.
- **Faster inspection** (2026-11-07): accepts an early HTML head on large pages, preloads its text font and compresses report JSON.
- Cloudflare Free Worker and static pages replace the proposed Containers deployment.
- Reports show previews, observed tags, feedback and repair snippets. HTML form works without JavaScript.

## Up next

- Observe real search demand and free-tier availability. No revenue or traffic forecast is established.
- Ads remain off until a publisher/site and placements are approved.

Next action: Monitor real inspection failures and traffic before adding infrastructure.

<details><summary>Technical details</summary>

| Item | State | Evidence | Date |
| --- | --- | --- | --- |
| Faster inspection | Shipped | Live HTTP/browser checks passed; sample JSON response 52,694 → 7,732 transferred bytes with gzip; reports remain no-store | 2026-11-07 |
| Public Open Graph review | Shipped | https://metaprev.forsvn.com — deployment 232b9841-5179-493a-9327-9ebcc4f03eb7; live checks passed | 2026-11-07 |


46 security/fetch tests, both typechecks, and 42 live HTTP checks passed.
All 56 live browser checks passed. Acceptance covers four widths, metadata/JSON copy, platform tabs,
unsafe URL rejection, image delivery and no-JavaScript submission. Evidence is in
ignored `site/artifacts/speed-browser/`; screenshots were captured with Cap.
Deployment is `metaprev-free`; `site/README.md` documents limits and reproduction.
HTML opts out of automatic Cloudflare analytics injection; JS/CSS compression was verified.
No paid plan was purchased. No Containers, database or paid bindings are configured.

</details>

## Gates

- Owner approved the free route. No paid upgrade or metered service is authorized.

- Cloudflare hosting is authorized as of 2026-11-06; verify access, costs, and operational settings before deployment.
- Deployment hold lifted by Hung on 2026-11-06. Keep public indexing off until live acceptance passes; PR #8 remains historical draft context.
- Live HTTPS, inspection and form acceptance passed; public pages are indexable. Inspection responses remain no-store/noindex.
- Per-isolate request guards are not global quotas. Free platform ceilings can interrupt service; image cache can expire early.
- Advertising needs a publisher account and a separate owner decision after the tool is live.
- Search indexing, field performance, and AI citations need observations after authorized public deployment.
- Website acceptance: [security and HTTP contract](site/test/acceptance.md). Messaging changes: [failure modes and acceptance contract](app/docs/messaging-surfaces.md).

## Later

- Historical release gaps and deferred outcomes remain in [docs/progress-log.md](docs/progress-log.md); none are active commitments.

## 2026-11-06

- Latest direction supersedes the earlier paid-pilot approval: Hung prefers free hosting and wants to assess similar tools before confirming spending. No subscription purchase is established. Browser-only conversion and a small free Worker are candidates, not implemented or validated replacements.

- Hung approved a MetaPrev-first 90-day validation pilot after reviewing the ad-revenue scenarios: $15 in base hosting over three months, with usage kept bounded. This is not a fixed total-bill guarantee or a revenue forecast. TalkToBook paid hosting is deferred.
- Checkout is open in Helium but requires the owner’s payment/billing information. No charge or Workers Paid activation is verified. The owner completed Cloudflare CLI OAuth authorization; image deployment can use that local login while Executor remains the API access route.
- Pilot acceptance: verify public inspection and images, enable indexing only after live checks, measure search demand and actual ad earnings, and review economics after 90 days. No scheduled task was created. No publisher ID was found in the project; ads remain off until a publisher/site is approved. Intended ad placement is useful guides, not private inspection output.

- Dashboard verification in Helium: the FORSVN account token already has Containers Read/Edit. The account is on Workers Free; the Containers page explicitly requires Workers Paid ($5/month plus usage). No token permissions changed and no subscription was purchased. Spending approval is pending. A subsequent authenticated CLI request confirmed HTTP 401 with an explicit message that Containers requires Workers Paid.

- Deployment to `metaprev.forsvn.com` is authorized. DNS and Workers reads succeeded through Executor, but Containers returned HTTP 401. CLI fallback has no login. No public deployment completed.
- Recovered hosting source from PR #8 into the current checkout. Docker is running; edge typecheck/build and the Linux container build passed. Verified 32 security tests, 7 client-limit checks, and 42 container HTTP checks including live external inspection. Evidence: ignored `site/artifacts/deployment/results.json` and `site/artifacts/container-http/results.json`.

- Cloudflare access repaired in Executor: replaced live full-schema discovery with a bundled 72-path catalog (126 tools). Type checks, reference validation, tool discovery and a real read-only account request passed. Credentials and mutation approval rules were retained. Hosting deployment itself is still pending.

- Cloudflare diagnosis: a fresh Executor account check returned healthy on 2026-11-06. Tool discovery still times out. The deployed app separately loads the full Cloudflare OpenAPI schema through liveOpenapiRouter; loader cost or serialization size is the likely failure area, not rejected credentials. Browser fallback reached sign-in in the shared preview and a security challenge with the Chrome profile; no authenticated dashboard access or deployment was verified.

- Hung requested usable public web apps and selected Cloudflare hosting. Existing web interfaces are present in source; public deployment remains unverified.
- Cloudflare tool discovery through Executor failed (timeout followed by app evaluation failure). Local Docker cannot connect to its daemon.
- Added a report navigation path from feedback to observed tags and repair snippets. Typecheck and 32 security tests passed. Full visual review and deployment remain outstanding.


## 2026-11-01

- Migrated the records to PROGRESS. Old STATUS.md and ROADMAP.md are in
  commit `227393af4a3d08d5cc9ab91e9c833b2c405ef0de`. Preserved dated evidence
  in [docs/progress-log.md](docs/progress-log.md); no runtime or provider access was reverified.

## 2026-10-26

- Built messaging simulations in [PR #9](https://github.com/forsvn-labs/metaprev/pull/9), merged by Hung. No release or deployment claimed; live-client comparison remains outstanding.

## 2026-10-24

- Built website source in [PR #7](https://github.com/forsvn-labs/metaprev/pull/7), merged by Hung. Launch preparation in draft PR #8 stopped at the owner's request after container provisioning failed; no payment confirmation was submitted.

## 2026-09-19

- Last recorded shipped package: `@forsvn/metaprev` version `0.6.0`, tag `v0.6.0` at
  `c030fb3`. See [CHANGELOG.md](CHANGELOG.md); later source work is not release evidence.
