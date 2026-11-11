# Progress

Updated: 2026-11-11 · Stage: live · Health: Live acceptance passed

## Shipped

- **Capacity recovery and guide support** (2026-11-11): live inspections now give retry guidance when busy, recover from temporary image storage failures, and keep findings when an image expires. All ten guides offer voluntary support through the existing GitHub Sponsors page.

- **Bounded inspection** (2026-11-11): the live inspector handles the tested malformed pages without excessive parser work, releases cancelled requests, and keeps image facts when preview storage fails. Live HTTP, browser and image checks pass. The npm package is unchanged.

- **Content pilot** (2026-11-07): ten guides and the GitHub Sponsors support link are live. Authors can edit guides in the local CMS and publish through the existing build.

- **Public Open Graph review** (2026-11-07): live at https://metaprev.forsvn.com, alongside the existing CLI.
- **Faster inspection** (2026-11-07): accepts an early HTML head on large pages, preloads its text font and compresses report JSON.
- Cloudflare Free Worker and static pages replace the proposed Containers deployment.
- Reports show previews, observed tags, feedback and repair snippets. HTML form works without JavaScript.

## In progress

None for this release.

## Up next

- Restore the expired Google authorization before recording search baselines. Remote CMS OAuth, daily automation and ad-network onboarding remain unconfigured.
- Observe real search demand and free-tier availability. No revenue or traffic forecast is established.
- Ads remain off until a publisher/site and placements are approved.

Next action: Observe live reliability and free-tier availability. Search access and content observations remain pending.

<details><summary>Technical details</summary>

| Item | State | Evidence | Date |
| --- | --- | --- | --- |
| Capacity recovery and guide support | Merged and live | [PR #16](https://github.com/forsvn-labs/metaprev/pull/16), deployed source `5d23277547dbb50660185ac2c6a081b470a3163c`; Worker version `09587359-fea0-4fd0-841f-4b9d40148cb9` at 100%. 78 site/Worker and 96 CLI tests pass; lint has no errors, three typechecks and build pass. Live HTTP 60/60, inspection browser, ten-guide support and six image/cache checks pass. Evidence: ignored `site/artifacts/capacity/`; repeat commands in `docs/state-machines.md`. PR #16 merged normally as `8a468e5` through the existing authorized GitHub CLI. The three review findings are addressed; final CodeRabbit check is neutral. Merged-source deployment `42748ae1-6117-4ae8-9ff7-52d6e90239bd` passed public guide acceptance at two widths and six live cache/image checks. Follow-up evidence: `site/artifacts/capacity/review-followup/`. Self-inspection of the Worker hostname returned upstream 522/private 422; external acceptance targets passed. | 2026-11-11 |
| Bounded inspection | [PR #15](https://github.com/forsvn-labs/metaprev/pull/15); merged and deployed | 96 CLI tests and 62 site/Worker tests pass; three typechecks and free Worker build pass. Local 32 KB malformed-attribute median: 607.45 ms → 0.030 ms (five samples, Bun 1.4.3). Lint passes with zero errors and warnings; rules are unchanged. String/null fetch failures retain a diagnostic; repair escaping is covered by a compatibility test. Isolated browser checks pass. Worker version `44c5a5f5-1665-4597-89b0-66227c0246ab` serves 100% of traffic. Live HTTP 60/60, isolated browser, and 1200×630 PNG delivery pass; report/image no-store and noindex verified. Evidence: ignored `site/artifacts/inspection/lint-release/`; commands in [the acceptance contract](site/test/acceptance.md). | 2026-11-11 |
| Content pilot | Shipped | PRs [#13](https://github.com/forsvn-labs/metaprev/pull/13) and [#14](https://github.com/forsvn-labs/metaprev/pull/14); deployed `b3d551bc-7289-4ded-bcc7-0c4efbd61f18`. 52 unit/security tests, both typechecks, production build, 60 live HTTP checks and 85 live browser checks passed. Artifacts: `site/artifacts/content-live/` and `site/artifacts/http/results.json`. Local CMS save was verified before release; setup: `site/cms/README.md`. | 2026-11-07 |
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

## 2026-11-11

- Inspection fixes are merged and live on the existing free Worker. Synthetic parser measurements
  show the confirmed malformed-input CPU problem is removed for the tested cases.
  Request cancellation, slot recovery, cache failure and concurrent report tests pass.
  The 21 lint errors and five warnings are resolved without rule changes.
  Two non-Error fetch regression tests failed before the diagnostic fix and pass after it.
  Live HTTP (60/60), browser and image delivery checks pass. Deployment version:
  `44c5a5f5-1665-4597-89b0-66227c0246ab`; evidence is in
  `site/artifacts/inspection/lint-release/`. No npm package was published.
- Support remains the existing GitHub Sponsors link; isolated browser verification
  confirmed it is present. No ads, paid bindings or pricing changes were made.
  A scoped option is to test clearer voluntary-support text on public guides after
  traffic measurement access is restored. Keep private reports ad-free and the core
  tool free. No conversion uplift or revenue is established.

## 2026-11-07

- Published the ten-guide content pilot and GitHub Sponsors link. Cloudflare rejected the initial upload because a module-level date check ran against its startup clock; moved date validation to the static build and verified the corrected live deployment. The editor remains local; ads, daily automation and remote CMS login are not configured.

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
