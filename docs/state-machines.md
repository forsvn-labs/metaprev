# State machines

Audit baseline: `16f0f02` on 2026-11-11. Target: Cloudflare Free Worker
`metaprev-free`, static guides, and the browser inspector. Fixes are in this PR.
Method: executed failures (E1), code paths (E2), deterministic clocks, and independent
request streams with barriers. No production data writes or migrations.

## Summary

| Machine | States | Confirmed | Fixed | Open issues |
| --- | --- | --- | --- | --- |
| admission | 3 | 2 | 2 | 0 |
| inspection | 3 | 0 | 0 | 0 |
| image-cache | 4 | 2 | 2 | 0 |
| browser-inspection | 4 | 1 | 1 | 0 |
| guide-publication | 2 | 0 | 0 | 0 |

Inventory: admission owns per-isolate IP windows and occupied slots; inspection
owns one request and its remote reads; image-cache owns temporary opaque IDs;
browser-inspection owns visible reports and retries; guide-publication owns
which records enter static output. These are all user-visible lifecycle writers
in the deployed scope. CLI/local-server lifecycles are unchanged and excluded
from this focused Worker audit. Payment is external to MetaPrev: the guide link
opens the verified owner's public GitHub Sponsors listing. There is no payment,
account, entitlement, ad or billing state in this application. Pure tabs and copy
controls are excluded because they do not change data or initiate remote reads.

## Machines

### Machine: admission · Isolate capacity

- **States:** `eligible`, `occupied`, `denied`
- **Initial:** `eligible`
- **Terminal:** `denied`
- **Authority:** `createAdmission` in `site/edge/src/admission.ts`
- **Subject:** one admission attempt; buckets and slot count live only in its isolate
- **Encoding:** active count 0–4; map of at most 5000 keys, count 0–20 and expiry

#### States

| State | Meaning | Entered when | Permits |
| --- | --- | --- | --- |
| `eligible` | New attempt | Request reaches admission | acquire |
| `occupied` | Slot held | Window and capacity permit | release |
| `denied` | Rejected, no slot | Rate or capacity full | New explicit attempt |

#### Transitions

| From | Event | Guard | To | Effects | Evidence |
| --- | --- | --- | --- | --- | --- |
| `eligible` | acquire | active < 4; key count < 20; key exists or map < 5000 after expiry sweep | `occupied` | Increment count and active synchronously | `site/edge/src/admission.ts` |
| `eligible` | reject | active >= 4, map full, or key count >= 20 | `denied` | 503 for capacity; 429 for rate; Retry-After | `site/edge/src/index.ts` |
| `occupied` | release | not already released | `eligible` | Decrement active once | `site/edge/src/admission.ts` |
| `eligible` | duplicate-release | already released | `eligible` | No effect on other holders | `site/edge/src/admission.ts` |

Duplicate release is a no-op on the permit; it cannot decrement another holder.
The table models the holder aggregate; the individual completed request is terminal.

#### Invariants

| ID | Invariant | Enforced by | Evidence |
| --- | --- | --- | --- |
| INV-01 | At most four occupied slots; every exit releases once | Synchronous acquire and finally/release | `site/edge/src/index.ts` |
| INV-02 | Rate denial gives a 1–60 second delay; capacity is not caller abuse | Bounded counters and response headers | `site/edge/src/admission.ts` |
| INV-03 | Churn cannot evict a live bucket or grow the map past 5000 | Expired-only sweep; reject newcomers | `site/edge/test/admission.test.ts` |

Timers: a bucket expires at `until <= now`, 60000 ms after first admission.
Clock is read at request time, clamped to the last observed time (never at module
startup). Backward clock changes cannot reset quota or increase Retry-After above
60; a large rollback can delay actual expiry until the clock catches up. Isolate
restart loses counters. No global quota, persistent IP history or scheduler exists.
Bypasses: none inside the Worker; independent isolates are independent authorities.

### Machine: inspection · Request lifecycle

- **States:** `received`, `running`, `finished`
- **Initial:** `received`
- **Terminal:** `finished`
- **Authority:** Worker fetch handler
- **Subject:** POST request
- **Encoding:** admission permit, request signal, bounded body and remote reads

#### States

| State | Meaning | Entered when | Permits |
| --- | --- | --- | --- |
| `received` | Request received | POST | Guard checks |
| `running` | Permit held | Accepted by admission | Bounded fetch and parsing |
| `finished` | Response or cancellation | Success or failure | No more remote reads |

#### Transitions

| From | Event | Guard | To | Effects | Evidence |
| --- | --- | --- | --- | --- | --- |
| `received` | accept | same origin, valid method, permit | `running` | Read request | `site/edge/src/index.ts` |
| `received` | refuse | origin/method/admission rejects | `finished` | Private error | `site/edge/src/index.ts` |
| `running` | finish | bounded inspection completes | `finished` | Private report; release | `site/edge/src/index.ts` |
| `running` | fail-or-cancel | exception or signal | `finished` | Private error; release | `site/edge/src/index.ts` |

#### Invariants

| ID | Invariant | Enforced by | Evidence |
| --- | --- | --- | --- |
| INV-04 | Cancellation cannot hold request slots indefinitely | Signal-aware reads and finally | `site/edge/test/capacity.test.ts` |
| INV-05 | Untrusted URLs never bypass public URL/DNS/redirect checks | Every remote hop screened | `site/edge/src/free-fetch.ts` |

Timers: request body 5 seconds/16 KiB; HTML 10 seconds/128 KiB;
image 6 seconds/1 MiB; at most four redirects per fetch. DNS response is capped at
16 KiB. No automatic request retries. Cache failure preserves image facts and
removes only the preview URL. No data repair or durable report storage.

Concurrency interleaving (50 tested rounds): four independent request streams
reach a barrier while holding four permits; a fifth returns 503 without fetching;
all four controllers abort; each request finishes and releases once; a fresh
request reaches input validation (400). No sleeps select the interleaving.

### Machine: image-cache · Temporary preview

- **States:** `absent`, `stored`, `unavailable`, `expired`
- **Initial:** `absent`
- **Terminal:** `expired`
- **Authority:** Cloudflare Cache API, wrapped by `cacheOperation`
- **Subject:** random UUID and checked raster bytes, never a remote URL cache key
- **Encoding:** cache hit/miss/error; browser uses same-origin opaque path only

#### States

| State | Meaning | Entered when | Permits |
| --- | --- | --- | --- |
| `absent` | No entry | New inspection | Put verified bytes |
| `stored` | Entry may be read | Successful put | GET/HEAD |
| `unavailable` | Cache failed or timed out | Open/match/put error | Manual later request |
| `expired` | Missing at this edge | TTL/eviction/location miss | New explicit inspection |

#### Transitions

| From | Event | Guard | To | Effects | Evidence |
| --- | --- | --- | --- | --- | --- |
| `absent` | put | Checked raster, active signal | `stored` | TTL 300 seconds | `site/edge/src/index.ts` |
| `absent` | put-fails | Error, timeout or cancellation | `unavailable` | Keep image facts, omit URL | `site/lib/inspect-core.ts` |
| `stored` | read-hit | Valid UUID, GET/HEAD | `stored` | Private image, no URL fetch | `site/edge/src/index.ts` |
| `stored` | read-miss | Cache has no entry | `expired` | Private 404 | `site/edge/src/index.ts` |
| `stored` | read-fails | Cache throws/times out | `unavailable` | Private 503, Retry-After 5 | `site/edge/src/index.ts` |
| `unavailable` | retry-hit | Explicit request; entry exists | `stored` | Private image | `site/edge/src/index.ts` |
| `unavailable` | retry-miss | Explicit request; no entry | `expired` | Private 404 | `site/edge/src/index.ts` |

#### Invariants

| ID | Invariant | Enforced by | Evidence |
| --- | --- | --- | --- |
| INV-06 | Cache errors are bounded private responses and never expose errors/URLs | Deadline and fixed error text | `site/edge/test/capacity.test.ts` |
| INV-07 | Missing images never automatically refetch a remote URL | UUID-only cache endpoint; manual form recovery | `site/test/capacity-browser.sh` |

Timers: one second for each cache operation; caller abort ends waiting earlier.
The Cache API cannot cancel work already in progress. A late put may finish with
its original five-minute TTL; no report receives that abandoned UUID. It cannot
overwrite a newer report because every put has a new UUID. Cache bytes/location
and eviction are provider-owned; this is not a 24 MB globally bounded cache.
No remote URL, DNS result, or persistent report is stored in cache keys.

### Machine: browser-inspection · Reports and recovery

- **States:** `idle`, `checking`, `report`, `error`
- **Initial:** `idle`
- **Terminal:** —
- **Authority:** `site/public/app.js`
- **Subject:** form, busy flag, previous report and preview notice
- **Encoding:** busy Boolean, rendered result, error box

#### States

| State | Meaning | Entered when | Permits |
| --- | --- | --- | --- |
| `idle` | Ready | Load | Submit |
| `checking` | One POST pending | Submit | Ignore repeated submit |
| `report` | Findings shown | Successful response | New explicit submit |
| `error` | Error shown, old report retained | Failed POST | Explicit retry |

#### Transitions

| From | Event | Guard | To | Effects | Evidence |
| --- | --- | --- | --- | --- | --- |
| `idle` | submit | nonempty URL, not busy | `checking` | One POST | `site/public/app.js` |
| `report` | submit | not busy | `checking` | One POST | `site/public/app.js` |
| `error` | retry | not busy | `checking` | One POST | `site/public/app.js` |
| `checking` | repeated-submit | busy | `checking` | No second request | `site/public/app.js` |
| `checking` | success | ok JSON with report HTML | `report` | Replace report and stale notice | `site/public/app.js` |
| `checking` | failure | HTTP/network/timeout/invalid JSON | `error` | Keep old report, release busy | `site/public/app.js` |
| `report` | image-error | checked preview image fails | `report` | One notice; return-to-URL button, no POST | `site/public/app.js` |

#### Invariants

| ID | Invariant | Enforced by | Evidence |
| --- | --- | --- | --- |
| INV-08 | Capacity/image failures provide manual recovery without discarding findings | Error fallback and one recovery notice | `site/test/capacity-browser.sh` |

Timers: slow notice at 5 seconds; abort at 25 seconds. No background retry,
URL query parameter, browser storage, payment request or tracking event.

### Machine: guide-publication · Public guide build

- **States:** `draft`, `published`
- **Initial:** `draft`
- **Terminal:** —
- **Authority:** validated guide records and static allowlist build
- **Subject:** `site/data/guides.json` record
- **Encoding:** status and reviewed date

#### States

| State | Meaning | Entered when | Permits |
| --- | --- | --- | --- |
| `draft` | Excluded from output | Author saves draft | Edit |
| `published` | Eligible for static output | Valid content/review | Build and deployment |

#### Transitions

| From | Event | Guard | To | Effects | Evidence |
| --- | --- | --- | --- | --- | --- |
| `draft` | publish | Valid schema, unique slug, review date not future at build | `published` | Included in guide routes | `site/lib/content.ts` |
| `published` | withdraw | Author sets draft, rebuild/deploy | `draft` | Removed from generated output | `site/scripts/static.ts` |

#### Invariants

| ID | Invariant | Enforced by | Evidence |
| --- | --- | --- | --- |
| INV-09 | Support CTA appears only on guide articles and uses approved HTTPS destination | Explicit article option and parsed config | `site/test/content.test.ts` |

No automatic publication timer or payment tracking. The CMS only edits local
records; deployment remains explicit. GitHub owns support selection and payment.
Ownership checked 2026-11-11: authenticated GitHub connector nickname `hungv47`;
GitHub GraphQL `user(login:"hungv47").sponsorsListing.isPublic` is true; destination
matches existing `site/data/support.json` and `.github/FUNDING.yml`.

## Findings

| ID | Severity | Status | Machine | Finding | Evidence | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | Low | Fixed | admission | Rate rejection lacked retry delay, breaking INV-02 | `test: rate rejection includes a bounded Retry-After and private headers` | I-01 |
| F-02 | Low | Fixed | admission | Full slots reported caller abuse, breaking INV-02 | `test: independent requests occupy four slots; overflow is retryable service capacity` | I-01 |
| F-03 | Medium | Fixed | image-cache | Cache read errors escaped private handler, breaking INV-06 | `test: cache failures return private 503 without exposing error or fetching target` | I-02 |
| F-04 | Medium | Fixed | image-cache | Stalled cache work had no deadline, breaking INV-06 | `test: stalled cache lookup has a deadline and no unsafe remote fallback` | I-02 |
| F-05 | Low | Fixed | browser-inspection | Failed images had no explicit return-to-form action, weakening INV-08 | `site/test/capacity-browser.sh` | I-03 |

## Issues

| ID | Priority | Status | Findings | Title | Link |
| --- | --- | --- | --- | --- | --- |
| I-01 | P2 | Fixed | F-01, F-02 | Distinguish caller limits from capacity | https://github.com/forsvn-labs/metaprev/pull/16 |
| I-02 | P2 | Fixed | F-03, F-04 | Bound cache failure and cancellation | https://github.com/forsvn-labs/metaprev/pull/16 |
| I-03 | P3 | Fixed | F-05 | Explicit preview recovery | https://github.com/forsvn-labs/metaprev/pull/16 |

## Fix log

All five findings are fixed in commit `e1a8f12` in [PR #16](https://github.com/forsvn-labs/metaprev/pull/16); regression
outputs are in ignored `site/artifacts/capacity/`: `red.txt` (3 failures),
`cache-red.txt` (deadline failure), `browser-red.txt` (missing recovery),
`support-red.txt` (missing CTA), and corresponding passing output. Tests precede
fixes. No separate issue was filed for work already implemented in this PR.

## Rollout and recovery

No schema, data migration, account change, paid binding, or CLI change. Deploy
through the existing authorized free Worker route after tests. The repository
merge was attempted but the GitHub connector returned 403; the tested, pushed
head was deployed independently. Merge remains required to align main with live. Verify
public guides, one inspection, private image/error headers, and existing HTTP
acceptance without a public load test. If needed, redeploy prior known-good source
(`16f0f02`, prior version `44c5a5f5-1665-4597-89b0-66227c0246ab`) on the same route.
Old opaque image URLs still work until eviction; old browser clients retain
compatible JSON and HTML contracts. Additional 503 responses distinguish service
capacity; Retry-After is additive. A deployment can reset per-isolate rate windows.

## Limits and repeatable evidence

Local guard envelope: 4 simultaneous inspections; 20 per caller per 60 seconds;
5000 caller entries; 20000 additional identities rejected; exact expiry and clock
rollback tested; 50 independent-stream cancellation rounds. This is a deterministic
state/resource test, not an RPS, billing, total-memory or availability benchmark.
Provider CPU/request ceilings, eviction and network isolation remain external.
Platform-level failures may bypass application headers; the browser handles
non-JSON 429/503 responses. Cloudflare CPU/runtime behavior is not proven by Bun.

Commands: `cd site && bun run test`; `cd app && bun test && bun run lint && bun run typecheck`;
`cd site/edge && bun run typecheck && PUBLIC_INDEXING=on bun run build`.
Start `bun site/test/capacity-fixture.ts`, then run
`bash site/test/capacity-browser.sh` once with fresh fixture counters. Existing
`bash site/test/inspection-browser.sh` checks real public inspection. HTTP acceptance
is `BASE=https://metaprev.forsvn.com bun site/test/http.ts`.

## Drift anchors

| Machine | Symbol | File | Why |
| --- | --- | --- | --- |
| admission | createAdmission | `site/edge/src/admission.ts` | Single capacity authority |
| inspection | fetch | `site/edge/src/index.ts` | Permit lifecycle |
| image-cache | cacheOperation | `site/edge/src/cache-operation.ts` | Deadline and cancellation |
| browser-inspection | watchImage | `site/public/app.js` | Manual recovery |
| guide-publication | articleShell | `site/lib/page.ts` | Guide-only support |

The document checker passes with two expected warnings: browser inspection and
guide publication permit repeated use and have no terminal state. These warnings
do not indicate unreachable states.

## Release evidence

2026-11-11: deployed source `5d23277547dbb50660185ac2c6a081b470a3163c` through the
existing Free route. Worker version `09587359-fea0-4fd0-841f-4b9d40148cb9` serves
100% of traffic; its only binding is static assets. Live HTTP 60/60, real
inspection browser, ten-guide support browser, and six cache/image checks pass.
Repeat the last check with `bun site/test/cache-live.ts`; it makes one external
inspection and checks private GET/HEAD image delivery plus a missing opaque ID.
No public load test was performed. Evidence is in `site/artifacts/capacity/`.

Repository merge remains blocked: GitHub connector returned `403 Resource not
accessible by integration`. No alternate identity or access route was used.
PR #16 is mergeable with no reported checks or review decision. Owner edits to
AdSense/Google readiness remain uncommitted and excluded from this PR. Google
reconnection is still required; site approval/consent/placement gates remain.
No ads, account changes, physical-device work or npm release occurred.

Observed limit: inspection of the Worker's own hostname returned an upstream
522 as a private 422. The external acceptance targets passed. This change does
not bypass Workers routing/network isolation or claim all targets are reachable.
