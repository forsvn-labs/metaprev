# Progress

Updated: 2026-11-06 · Stage: building · Health: At risk

Public launch work resumed on 2026-11-06 with Cloudflare selected by Hung. The earlier hold was recorded
([draft PR #8](https://github.com/forsvn-labs/metaprev/pull/8)). Website and
messaging source merged; no public backend or later package release is established.

Next action: Complete the approved Workers Paid checkout, deploy and verify `metaprev.forsvn.com`, then enable indexing. Pilot scope is MetaPrev first; TalkToBook hosting is deferred.

## Current state

| State | Item | Evidence | Date |
| --- | --- | --- | --- |

## Gates

- Cloudflare hosting is authorized as of 2026-11-06; verify access, costs, and operational settings before deployment.
- Deployment hold lifted by Hung on 2026-11-06. Keep public indexing off until live acceptance passes; PR #8 remains historical draft context.
- If resumed, confirm hosting, HTTPS, edge per-client limits, and operational log settings; verify inspection, image delivery, and the HTML form before indexing or changing the project link.
- A multi-process host needs shared edge limits; request counters and image cache are process-local.
- Advertising needs a publisher account and a separate owner decision after the tool is live.
- Search indexing, field performance, and AI citations need observations after authorized public deployment.
- Website acceptance: [security and HTTP contract](site/test/acceptance.md). Messaging changes: [failure modes and acceptance contract](app/docs/messaging-surfaces.md).

## Later

- Historical release gaps and deferred outcomes remain in [docs/progress-log.md](docs/progress-log.md); none are active commitments.

## 2026-11-06

- Hung approved a MetaPrev-first 90-day validation pilot after reviewing the ad-revenue scenarios: $15 in base hosting over three months, with usage kept bounded. This is not a fixed total-bill guarantee or a revenue forecast. TalkToBook paid hosting is deferred.
- Checkout is open in Helium but requires the owner’s payment/billing information. No charge or Workers Paid activation is verified. The owner completed Cloudflare CLI OAuth authorization; image deployment can use that local login while Executor remains the API access route.
- Pilot acceptance: verify public inspection and images, enable indexing only after live checks, measure search demand and actual ad earnings, and review economics after 90 days. No scheduled task was created. No publisher ID was found in the project; ads remain off until a publisher/site is approved. Intended ad placement is useful guides, not private inspection output.

- Dashboard verification in Helium: the FORSVN account token already has Containers Read/Edit. The account is on Workers Free; the Containers page explicitly requires Workers Paid ($5/month plus usage). No token permissions changed and no subscription was purchased. Spending approval is pending. The exact cause of the API 401 is not independently isolated from this plan limitation.

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
